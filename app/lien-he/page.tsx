import type { Metadata } from "next";
import Link from "next/link";

import StaticPageShell from "@/components/StaticPageShell";

export const metadata: Metadata = {
  title: "Liên hệ",
  description: "Thông tin liên hệ và phạm vi tiếp nhận phản hồi cho KetquaWC.vn.",
  alternates: { canonical: "/lien-he" },
};

function ContactCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-300">{body}</p>
    </div>
  );
}

export default function ContactPage() {
  return (
    <StaticPageShell
      label="Liên hệ"
      title="Liên hệ với KetquaWC.vn"
      description="Trang này dùng để mô tả phạm vi tiếp nhận phản hồi của website. Hiện repo chưa cấu hình công khai email hoặc biểu mẫu liên hệ riêng, nên các đầu mối bên dưới được giữ ở mức mô tả vận hành."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ContactCard
          title="Góp ý nội dung"
          body="Nếu bạn phát hiện tỷ số, lịch thi đấu, bảng xếp hạng hoặc bài nhận định có vấn đề, hãy gửi phản hồi qua đầu mối vận hành đang gắn với tên miền hoặc kênh triển khai chính thức của dự án."
        />
        <ContactCard
          title="Hợp tác dữ liệu / tài trợ"
          body="Các yêu cầu hợp tác thương mại, tài trợ hiển thị hoặc tích hợp dữ liệu nên được gửi tới đơn vị vận hành website qua kênh làm việc chính thức hiện có của dự án."
        />
        <ContactCard
          title="Báo lỗi kỹ thuật"
          body="Nếu gặp lỗi 404, dữ liệu không tải, layout vỡ hoặc vấn đề hiệu năng, vui lòng mô tả rõ URL, thời điểm xảy ra và ảnh chụp màn hình nếu có để đội vận hành dễ tái hiện."
        />
        <ContactCard
          title="Trạng thái đầu mối"
          body="Tại thời điểm hiện tại, website chưa công bố công khai email hỗ trợ hoặc form liên hệ riêng trong codebase. Khi có đầu mối chính thức, trang này nên được cập nhật ngay để người dùng có kênh gửi yêu cầu trực tiếp."
        />
      </div>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">Điều cần kèm theo khi phản hồi</h2>
        <p className="mt-3">
          Để phản hồi được xử lý nhanh hơn, nên kèm URL cụ thể, giải đấu hoặc trận đấu liên quan, thời điểm quan sát lỗi theo múi giờ Việt Nam và mô tả ngắn gọn hành vi mong đợi so với hành vi thực tế.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">Điều hướng nhanh</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/" className="action-secondary">
            Về trang chủ
          </Link>
          <Link href="/chinh-sach-bao-mat" className="action-secondary">
            Chính sách bảo mật
          </Link>
          <Link href="/dieu-khoan-su-dung" className="action-secondary">
            Điều khoản sử dụng
          </Link>
        </div>
      </section>
    </StaticPageShell>
  );
}
