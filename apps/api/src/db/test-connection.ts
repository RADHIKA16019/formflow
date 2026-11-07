
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const client = postgres(process.env.DATABASE_URL!);

try {
  const result = await client`SELECT NOW() AS current_time`;

  console.log("Database connected successfully!");
  console.log(result);
} catch (error) {
  console.error("Database connection failed:", error);
} finally {
  await client.end();
}
