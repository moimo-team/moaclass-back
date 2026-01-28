export class BaseMeetingDto {
  meetingId: number;
  title: string;
  interestName?: string;
  maxParticipants: number;
  currentParticipants: number;
  address: string;
  meetingDate: string;
}

export class MeetingItemDto extends BaseMeetingDto {
  meetingImage: string | null;
}

export class MyMeetingDto extends BaseMeetingDto {
  meetingImage: string | null;
  status: string;
  isHost: boolean;
  isCompleted: boolean;
}
