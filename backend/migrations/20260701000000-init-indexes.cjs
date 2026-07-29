module.exports = {
  async up(db) {
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ role: 1 });
    await db.collection("jobs").createIndex({ verificationHash: 1 }, { unique: true });
    await db.collection("jobs").createIndex({ title: "text", company: "text" });
    await db.collection("verifications").createIndex({ jobId: 1, createdAt: -1 });
    await db.collection("verifications").createIndex({ band: 1 });
    await db.collection("feedbacks").createIndex({ jobId: 1 });
    await db.collection("feedbacks").createIndex({ userId: 1 });
    await db.collection("modelmetrics").createIndex({ modelVersion: 1, day: 1 }, { unique: true });
    await db.collection("auditlogs").createIndex({ actorId: 1, createdAt: -1 });
  },
  async down(db) {
    for (const c of ["users","jobs","verifications","feedbacks","modelmetrics","auditlogs"]) {
      try { await db.collection(c).dropIndexes(); } catch {}
    }
  },
};
