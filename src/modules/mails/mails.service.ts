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
      from: `"Support MoaClass" <${process.env.MAIL_USER}>`,
      to: email,
      subject: '비밀번호 재설정 인증코드',
      html: `<p>아래 인증코드를 입력하세요:</p><h2>${code}</h2>`,
    });
  }
  async sendEnrollmentEmail(email: string, details: any) {
    const { title, startAt, endAt, address, quantity, originPrice, discountAmount, finalPrice } = details;
    await this.transporter.sendMail({
      from: `"Support Moaclass" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `[MoaClass] 클래스 수강 신청이 완료되었습니다: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #4CAF50; text-align: center;">수강 신청 완료!</h2>
          <p>안녕하세요, <strong>MoaClass</strong>입니다. 신청하신 클래스의 정보와 결제 내용을 안내해 드립니다.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;">클래스 정보</h3>
            <p style="margin: 5px 0;"><strong>클래스명:</strong> ${title}</p>
            <p style="margin: 5px 0;"><strong>수강 시간:</strong> ${startAt} ~ ${endAt}</p>
            <p style="margin: 5px 0;"><strong>장소:</strong> ${address}</p>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;">결제 내역</h3>
            <p style="margin: 5px 0;"><strong>신청 인원:</strong> ${quantity}명</p>
            <p style="margin: 5px 0;"><strong>주문 금액:</strong> ${originPrice.toLocaleString()} 원</p>
            <p style="margin: 5px 0; color: #f44336;"><strong>할인 금액:</strong> -${discountAmount.toLocaleString()} 원</p>
            <p style="margin: 10px 0; font-size: 1.2em; color: #4CAF50;"><strong>최종 결제 금액:</strong> ${finalPrice.toLocaleString()} 원</p>
          </div>

          <div style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #777;">
            <p>클래스 시작 전에 장소와 시간을 다시 한번 확인해 주세요.</p>
            <p>궁금하신 점이 있다면 언제든 문의해 주세요. 감사합니다!</p>
          </div>
        </div>
      `,
    });
  }
}
