import 'dotenv/config';
import process from 'node:process';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx ts-node prisma/seed.ts',
  },
  datasource: {
    // Prisma 7에서는 여기서 연결 문자열을 관리합니다
    url: process.env.DATABASE_URL!,
  },
});
