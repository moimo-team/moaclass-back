import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

async function generateSwaggerFile() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Moaclass API')
    .setDescription('Moaclass backend API documentation')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const outputDir = join(process.cwd(), 'swagger');
  const outputPath = join(outputDir, 'openapi.json');

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  await app.close();
  // eslint-disable-next-line no-console
  console.log(`Swagger file generated: ${outputPath}`);
}

generateSwaggerFile().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate Swagger file', error);
  process.exit(1);
});
