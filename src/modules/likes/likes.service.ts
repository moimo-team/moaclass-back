// import {
//   Injectable,
//   InternalServerErrorException,
//   ConflictException,
//   NotFoundException,
// } from '@nestjs/common';
// import { PrismaService } from '../../prisma/prisma.service';
// import { Prisma } from '@prisma/client';
// import { PageMetaDto } from '../common/dto/page-meta.dto';
// import { PageDto } from '../common/dto/page.dto';
// import { PageOptionsDto } from '../common/dto/page-options.dto';

// @Injectable()
// export class LikesService {
//   constructor(private prisma: PrismaService) {}

//   async create(userId: number, lessonId: number) {
//     const lesson = await this.prisma.lesson.findUnique({
//       where: { id: lessonId },
//     });

//     if (!lesson) {
//       throw new NotFoundException('존재하지 않는 클래스입니다.');
//     }

//     try {
//       return await this.prisma.$transaction(async (tx) => {
//         const wishlist = await tx.wishlist.create({
//           data: {
//             userId: userId,
//             lessonId: lessonId,
//           },
//         });
//         await tx.lesson.update({
//           where: { id: lessonId },
//           data: {
//             likes: { increment: 1 },
//           },
//         });

//         return wishlist;
//       });
//     } catch (error) {
//       if (error instanceof Prisma.PrismaClientKnownRequestError) {
//         if (error.code === 'P2002') {
//           throw new ConflictException('이미 위시리스트에 추가된 클래스입니다.');
//         }
//       }
//       throw new InternalServerErrorException(
//         '위시리스트 추가 중 오류가 발생했습니다.',
//       );
//     }
//   }

//   async remove(userId: number, lessonId: number) {
//     try {
//       await this.prisma.$transaction(async (tx) => {
//         await tx.wishlist.delete({
//           where: {
//             userId_lessonId: {
//               userId: userId,
//               lessonId: lessonId,
//             },
//           },
//         });

//         await tx.lesson.update({
//           where: { id: lessonId },
//           data: {
//             likes: { decrement: 1 },
//           },
//         });
//       });
//     } catch (error) {
//       if (error instanceof Prisma.PrismaClientKnownRequestError) {
//         if (error.code === 'P2025') {
//           throw new NotFoundException(
//             '위시리스트에 해당 클래스가 존재하지 않습니다.',
//           );
//         }
//       }
//       throw new InternalServerErrorException(
//         '위시리스트 삭제 중 오류가 발생했습니다.',
//       );
//     }
//   }

//   async findAll(userId: number, pageOptionsDto: PageOptionsDto) {
//     const { page = 1, limit = 5 } = pageOptionsDto;
//     const skip = (page - 1) * limit;

//     try {
//       const [totalCount, items] = await Promise.all([
//         this.prisma.wishlist.count({ where: { userId } }),
//         this.prisma.wishlist.findMany({
//           where: { userId },
//           skip,
//           take: limit,
//           include: {
//             lesson: {
//               include: {
//                 teacher: {
//                   include: {
//                     teacherProfile: true,
//                   },
//                 },
//                 lessonCategory: true,
//                 region: true,
//               },
//             },
//           },
//           orderBy: { createdAt: 'desc' },
//         }),
//       ]);

//       const data = items.map((item) => {
//         const lesson = item.lesson;

//         return {
//           lessonId: lesson.id,
//           title: lesson.title,
//           image: lesson.representativeImage,
//           categoryName: lesson.lessonCategory?.name ?? '미지정',
//           teacherNickname:
//             lesson.teacher?.teacherProfile?.nickname ?? '익명 강사',
//           regionName: lesson.region?.name ?? '지역 정보 없음',
//           price: lesson.price,
//         };
//       });

//       const pageMetaDto = new PageMetaDto(totalCount, page, limit);
//       return new PageDto(data, pageMetaDto);
//     } catch {
//       throw new InternalServerErrorException(
//         '위시리스트 조회 중 오류가 발생했습니다.',
//       );
//     }
//   }
// }
