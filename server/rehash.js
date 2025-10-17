import bcrypt from "bcryptjs";

const run = async () => {
  const hash = await bcrypt.hash("admin", 10);
  console.log("New hash:", hash);
};

run();
