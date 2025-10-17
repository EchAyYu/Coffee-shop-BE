import bcrypt from "bcryptjs";

const hash = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const run = async () => {
  const ok = await bcrypt.compare("admin", hash);
  console.log("Match?", ok);
};

run();
