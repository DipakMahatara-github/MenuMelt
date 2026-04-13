import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PasswordField({
  className = "",
  wrapperClassName = "",
  buttonClassName = "",
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("relative", wrapperClassName)}>
      <input {...props} type={visible ? "text" : "password"} className={className} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className={cn(
          "absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 transition focus:outline-none focus-visible:ring-2",
          buttonClassName
        )}
      >
        {visible ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
      </button>
    </div>
  );
}
