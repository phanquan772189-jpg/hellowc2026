import type { Metadata } from "next";

import StaticPageShell from "@/components/StaticPageShell";

export const metadata: Metadata = {
  title: "Chính sách bảo mật",
  description: "Chính sách bảo mật cho KetquaWC.vn, mô tả cách trang xử lý dữ liệu truy cập, log hệ thống và dịch vụ bên thứ ba.",
  alternates: { canonical: "/chinh-sach-bao-mat" },
};

export default function PrivacyPolicyPage() {
  return (
    <StaticPageShell
      label="Chính sách"
      title="Chính sách bảo mật"
      description="Trang này mô tả cách KetquaWC.vn xử lý dữ liệu khi người dùng truy cập website và tương tác với các trang match center, lịch thi đấu và bảng xếp hạng."
    >
      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">1. Phạm vi thu thập dữ liệu</h2>
        <p className="mt-3">
          KetquaWC.vn không yêu cầu người dùng tạo tài khoản để xem nội dung. Dữ liệu có thể được ghi nhận ở mức kỹ thuật gồm địa chỉ IP, user-agent, thời điểm truy cập, URL đã mở và log lỗi cần thiết để vận hành, bảo mật và tối ưu hiệu năng.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">2. Mục đích sử dụng</h2>
        <p className="mt-3">
          Dữ liệu kỹ thuật được dùng để giám sát ổn định hệ thống, phát hiện truy cập bất thường, đo hiệu suất trang, phân tích lỗi và cải thiện trải nghiệm đọc trên mobile và desktop.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">3. Cookie và công nghệ tương tự</h2>
        <p className="mt-3">
          Website có thể sử dụng cookie hoặc cơ chế lưu tạm thời của trình duyệt để duy trì hành vi hiển thị, đo lường traffic và phục vụ các dịch vụ hạ tầng hoặc analytics của bên thứ ba. Người dùng có thể giới hạn hoặc xoá cookie trong cài đặt trình duyệt của mình.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">4. Nguồn dữ liệu bên thứ ba</h2>
        <p className="mt-3">
          Tỷ số, lịch thi đấu, bảng xếp hạng và dữ liệu liên quan được đồng bộ từ API-Football và các dịch vụ hạ tầng mà dự án đang sử dụng. Các bên này có thể có chính sách bảo mật riêng và người dùng nên tham khảo trực tiếp nếu cần hiểu rõ hơn về luồng dữ liệu gốc.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">5. Thời gian lưu trữ</h2>
        <p className="mt-3">
          Log hệ thống và dữ liệu kỹ thuật chỉ được giữ trong khoảng thời gian cần thiết cho vận hành, giám sát an toàn và khắc phục sự cố. Khi không còn cần thiết, dữ liệu có thể bị xoá hoặc ẩn danh theo chính sách nội bộ của đơn vị vận hành.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-black tracking-tight text-white">6. Quyền của người dùng</h2>
        <p className="mt-3">
          Nếu bạn có yêu cầu liên quan đến dữ liệu cá nhân, quyền riêng tư hoặc muốn phản ánh nội dung, vui lòng dùng trang liên hệ để gửi yêu cầu tới đầu mối vận hành. Website sẽ xem xét và phản hồi trong phạm vi phù hợp với khả năng xác minh thông tin.
        </p>
      </section>
    </StaticPageShell>
  );
}
