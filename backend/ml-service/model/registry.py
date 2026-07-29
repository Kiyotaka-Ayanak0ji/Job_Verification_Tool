"""Versioned model artifact registry on disk.

Keeps only the newest MAX_PROMOTED promoted models (spec §2.3). Unpromoted
retrains (accuracy < gate) are pruned eagerly.
"""
import json, os, shutil, time
from pathlib import Path
import joblib

MAX_PROMOTED = 2


class ModelRegistry:
    def __init__(self, root="models"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _version_dirs(self):
        return [p for p in self.root.iterdir() if p.is_dir() and p.name.startswith("v")]

    def _manifest(self, vdir):
        try:
            return json.loads((vdir / "manifest.json").read_text())
        except Exception:
            return {}

    def list_models(self, promoted_only=True):
        rows = []
        for vdir in self._version_dirs():
            m = self._manifest(vdir)
            if promoted_only and not m.get("promoted"):
                continue
            rows.append({
                "version": m.get("version", vdir.name),
                "created_at": m.get("trained_at") or m.get("promoted_at"),
                "promoted_at": m.get("promoted_at"),
                "metrics": m.get("metrics", {}),
            })
        rows.sort(key=lambda r: r.get("promoted_at") or r.get("created_at") or "", reverse=True)
        return rows

    def latest(self):
        rows = self.list_models(promoted_only=True)
        return rows[0] if rows else None

    def version_dir(self, version):
        p = self.root / version
        return p if p.is_dir() else None

    def active_path(self):
        active = self.root / "active"
        if active.is_symlink():
            return active.resolve()
        if active.exists():
            return active
        latest = self.latest()
        if latest:
            return self.root / latest["version"]
        versions = sorted(self._version_dirs())
        if not versions:
            raise FileNotFoundError(f"No trained model under {self.root}; run scripts/train_seed.py")
        return versions[-1]

    def save(self, version, artifacts, manifest):
        vdir = self.root / version
        vdir.mkdir(parents=True, exist_ok=True)
        for name, obj in artifacts.items():
            joblib.dump(obj, vdir / f"{name}.joblib")
        manifest = {**manifest,
                    "trained_at": manifest.get("trained_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        (vdir / "manifest.json").write_text(json.dumps(manifest, indent=2, default=str))
        return vdir

    def promote(self, version):
        vdir = self.root / version
        m = self._manifest(vdir)
        m["promoted"] = True
        m["promoted_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        (vdir / "manifest.json").write_text(json.dumps(m, indent=2, default=str))
        active = self.root / "active"
        try:
            if active.is_symlink() or active.is_file():
                active.unlink()
            elif active.exists():
                shutil.rmtree(active, ignore_errors=True)
        except OSError:
            pass
        try:
            os.symlink(version, active, target_is_directory=True)
        except (OSError, NotImplementedError):
            (self.root / "ACTIVE").write_text(version)
        self.prune()

    def prune(self):
        keep = {row["version"] for row in self.list_models(promoted_only=True)[:MAX_PROMOTED]}
        removed = []
        for vdir in self._version_dirs():
            if vdir.name in keep:
                continue
            shutil.rmtree(vdir, ignore_errors=True)
            removed.append(vdir.name)
        return removed

    def load_active(self):
        vdir = self.active_path()
        manifest = self._manifest(vdir)
        artifacts = {p.stem: joblib.load(p) for p in vdir.glob("*.joblib")}
        return vdir, artifacts, manifest

    def load_version(self, version):
        vdir = self.version_dir(version)
        if not vdir:
            raise FileNotFoundError(f"Model {version} not found")
        manifest = self._manifest(vdir)
        artifacts = {p.stem: joblib.load(p) for p in vdir.glob("*.joblib")}
        return vdir, artifacts, manifest
