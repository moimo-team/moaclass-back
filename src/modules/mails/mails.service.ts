import { Injectable } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import 'dotenv/config';
@Injectable()
export class MailsService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  async sendResetCode(email: string, code: string) {
    await this.transporter.sendMail({
      from: `"Support Moimo" <${process.env.MAIL_USER}>`,
      to: email,
      subject: '비밀번호 재설정 인증코드',
      html: `<p>아래 인증코드를 입력하세요:</p><h2>${code}</h2>`,
    });
  }
}
