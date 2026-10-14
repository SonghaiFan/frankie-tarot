import signatureMarkup from "./frankie-signature.svg?raw";

const signaturePaths = [...signatureMarkup.matchAll(/<path\b[^>]*\/>/gi)]
  .map(([path]) => path)
  .join("");

const FrankSignature = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 481 164"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    role="img"
    aria-label="Frankie"
    dangerouslySetInnerHTML={{ __html: signaturePaths }}
  />
);

export default FrankSignature;
