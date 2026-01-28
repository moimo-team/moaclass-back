import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //CORS 설정
  app.enableCors({
    origin: [process.env.FRONTEND_URL, 'https://moimo.vercel.app'],

    credentials: true, // 쿠키/인증정보 포함 여부
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    exposedHeaders: ['Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 속성은 자동으로 제거 (보안)
      forbidNonWhitelisted: true, // DTO에 없는 속성이 들어오면 요청 자체를 차단
      transform: true, // JSON 데이터를 DTO 클래스 객체로 자동 변환
    }),
  );
  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
