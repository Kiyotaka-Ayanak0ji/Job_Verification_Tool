const bcrypt = require("bcryptjs");
module.exports = {
  async up(db) {
    const email = "admin@trusthire.dev";
    const exists = await db.collection("users").findOne({ email });
    if (exists) return;
    await db.collection("users").insertOne({
      email, name: "Root Admin", role: "admin", plan: "pro_yearly",
      searchesThisMonth: 0, suspended: false,
      passwordHash: await bcrypt.hash("Admin@Apex_1", 12),
      createdAt: new Date(), updatedAt: new Date(),
    });
  },
  async down(db) { await db.collection("users").deleteOne({ email: "admin@trusthire.dev" }); },
};
