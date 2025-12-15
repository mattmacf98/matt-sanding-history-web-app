import React from "react";

interface RenderIfProps {
  condition: boolean;
  children: React.ReactNode;
}

const RenderIf: React.FC<RenderIfProps> = ({ condition, children }) => {
  return condition ? <>{children}</> : null;
};

export default RenderIf;
