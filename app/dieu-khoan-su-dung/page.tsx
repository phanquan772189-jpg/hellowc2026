import type { Metadata } from "next";

import StaticPageShell from "@/components/StaticPageShell";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description: "Điều khoản sử dụng cho KetquaWC.vn, quy định phạm vi tham khảo thông tin, quyền và trách nhiệm khi truy cập website.",
  alternates: { canonical: "/dieu-khoan-su-dung" },
};

export default function TermsPage() {
  return (
    <StaticPageShell
      label="Điều khoản"
      title="Điều khoản sử dụng"
      description="Việc tiếp tục truy cập KetquaWC.vn đồng nghĩa với việc bạn chấp nhận phạm vi sử dụng của website như một nguồn thông tin tham khảo về bóng đá."
    >
      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">1. Tính chất thông tin</h2>
        <p className="mt-3">
          KetquaWC.vn là website thông tin cá nhân, tập trung vào livescore, lịch thi đấu, bảng xếp hạng và nhận định trận đấu. Nội dung trên site không phải lời khuyên tài chính, cá cược hoặc cam kết chính xác tuyệt đối tại mọi thời điểm.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">2. Giới hạn trách nhiệm</h2>
        <p className="mt-3">
          Dữ liệu bóng đá được đồng bộ từ bên thứ ba nên có thể phát sinh độ trễ, thiếu sót hoặc thay đổi sau khi đã hiển thị. Người dùng tự chịu trách nhiệm khi sử dụng dữ liệu này cho bất kỳ quyết định cá nhân hoặc thương mại nào.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">3. Hành vi sử dụng bị cấm</h2>
        <p className="mt-3">
          Người dùng không được cố ý gây quá tải hệ thống, thu thập dữ liệu trái phép, sao chép nguyên trạng nội dung với mục đích thương mại, phát tán mã độc hoặc thực hiện hành vi có thể ảnh hưởng tới tính sẵn sàng của website.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">4. Quyền chỉnh sửa nội dung</h2>
        <p className="mt-3">
          Đơn vị vận hành có quyền cập nhật giao diện, thay đổi cấu trúc route, chỉnh sửa nội dung, tạm dừng hoặc chấm dứt một phần chức năng mà không cần báo trước nếu điều đó cần thiết cho bảo trì, bảo mật hoặc định hướng sản phẩm.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">5. Liên kết ngoài</h2>
        <p className="mt-3">
          Website có thể chứa liên kết tới nguồn dữ liệu, đối tác hoặc nhà tài trợ. KetquaWC.vn không kiểm soát nội dung và chính sách của các website bên ngoài, vì vậy người dùng cần tự đánh giá trước khi truy cập hoặc giao dịch.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">6. Hiệu lực</h2>
        <p className="mt-3">
          Điều khoản này có hiệu lực kể từ khi được đăng tải trên website và có thể được cập nhật theo thời gian. Phiên bản đang hiển thị tại trang này là phiên bản đang được áp dụng.
        </p>
      </section>
    </StaticPageShell>
  );
}
