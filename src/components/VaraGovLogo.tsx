import Image from 'next/image';
import logo from '../../public/varagov-logo.png';

export default function VaraGovLogo() {
  return (
    <Image
      src={logo}
      alt="VaraGov"
      className="h-16 w-16 shrink-0 rounded-xl object-contain shadow-sm sm:h-20 sm:w-20"
      sizes="(min-width: 640px) 80px, 64px"
      priority
    />
  );
}
