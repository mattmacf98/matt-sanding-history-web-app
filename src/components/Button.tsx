import React from "react";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  // For mouse enter/leave styling
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
}

/**
 * Generic Button component with loading state and in-component spinner.
 * Accepts any native button props.
 * Used for step video generate button, can be reused elsewhere.
 */
const Button: React.FC<ButtonProps> = ({
  loading = false,
  loadingText = "Loading...",
  disabled = false,
  children,
  style = {},
  onMouseEnter,
  onMouseLeave,
  ...rest
}) => {
  // Styles for the loading spinner
  const spinnerStyle: React.CSSProperties = {
    width: "12px",
    height: "12px",
    border: "2px solid #ffffff",
    borderTop: "2px solid transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginRight: "6px",
  };

  // Default styles, can be overridden via "style" prop
  const defaultStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: "12px",
    backgroundColor: disabled ? "#9ca3af" : "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background-color 0.2s",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    ...style,
  };

  return (
    <button
      className="generate-video-button"
      disabled={disabled || loading}
      style={defaultStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...rest}
    >
      {loading ? (
        <>
          <div style={spinnerStyle} />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
