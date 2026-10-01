import Image from 'next/image';
import logo from '../../public/varagov-logo.png';

export default function VaraGovLogo() {
  return (
    <Image
      src={logo}
      alt="VaraGov"
      className="h-10 w-10 shrink-0 rounded-lg object-contain shadow-sm"
      sizes="40px"
      priority
    />
  );
}
