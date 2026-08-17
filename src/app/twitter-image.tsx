import {
  createSocialImage,
  socialImageContentType,
  socialImageSize,
} from "@/lib/social-image";

export const alt = "인혁이의 게임 월드 - 초등학생 게임 개발자 웹 게임 포트폴리오";
export const size = socialImageSize;
export const contentType = socialImageContentType;

export default function TwitterImage() {
  return createSocialImage();
}
