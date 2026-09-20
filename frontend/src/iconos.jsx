import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faHeartPulse, faCircleExclamation, faTriangleExclamation, faArrowDown, faArrowLeft, faArrowRight, faRightLeft,
    faArrowUp, faSuitcase, faBan, faChartColumn, faBell, faBomb, faBookmark, faRobot, faBrain, faBug, faBuilding,
    faCalendar, faCalendarCheck, faCalendarDays, faCamera, faCheck, faCircleCheck, faAppleWhole, faChevronDown,
    faChevronLeft, faChevronRight, faChevronUp, faAnglesRight, faCircleDollarToSlot, faClock, faCloud, faClover,
    faMugHot, faCoins, faPersonDigging, faCopy, faCrown, faDatabase, faDiamond, faDice, faCompactDisc, faDoorOpen,
    faDownload, faDroplet, faDumbbell, faPen, faEye, faEyeSlash, faFileLines, faFilter, faFlag, faFire, faFolder,
    faFaceFrown, faGamepad, faGem, faGhost, faGift, faGlobe, faHandshake, faHashtag, faHeart, faHeartCrack,
    faClockRotateLeft, faHouse, faImage, faCircleInfo, faKey, faFaceLaugh, faLayerGroup, faLeaf, faLightbulb, faLink,
    faSpinner, faLock, faRightFromBracket, faEnvelope, faLocationDot, faUpRightAndDownLeftFromCenter, faMedal,
    faFaceMeh, faComment, faMessage, faMinus, faMoon, faEllipsis, faUpDownLeftRight, faLeftRight, faMusic, faBox,
    faPaintbrush, faPalette, faPause, faPaw, faPerson, faChartPie, faPlay, faPlus, faArrowsRotate, faRepeat,
    faRotateLeft, faRotateRight, faRss, faFloppyDisk, faScaleBalanced, faIdCard, faScissors, faScroll,
    faMagnifyingGlass, faPaperPlane, faServer, faGear, faShareNodes, faShieldHalved, faBagShopping, faForwardStep,
    faSkull, faSliders, faFaceSmile, faArrowDownAZ, faWandMagicSparkles, faStar, faSun, faBullseye, faTicket,
    faStopwatch, faToggleOff, faToggleOn, faTrash, faArrowTrendDown, faArrowTrendUp, faCaretUp, faTrophy,
    faLockOpen, faUser, faUserMinus, faUserPlus, faUsers, faUtensils, faVolumeHigh, faVolumeXmark, faWheatAwn,
    faPlugCircleXmark, faXmark, faBolt, faHandFist, faCloudSun
} from '@fortawesome/free-solid-svg-icons';

/**
 * LOS ICONOS DE LA APP: Font Awesome (los solidos, libres).
 *
 * Antes eran de lucide-react, de trazo fino. Se piden los de Font Awesome y
 * se cambia AQUI, no en las ochenta pantallas que los usan: cada icono se
 * exporta con el mismo nombre que tenia en lucide y acepta los mismos props
 * (`size`, `className`, `style`, `color`). Los que solo tenian sentido con
 * trazos (`strokeWidth`, `fill`) se aceptan y se ignoran: un icono solido
 * ya va relleno.
 *
 * El `size` es el lado de la caja, como en lucide: el dibujo se centra dentro
 * y no se estira aunque no sea cuadrado.
 */
const crear = (icono) => {
    // eslint-disable-next-line no-unused-vars
    const Icono = ({ size = 24, className = '', style, color, strokeWidth, fill, absoluteStrokeWidth, ...resto }) => (
        <FontAwesomeIcon
            icon={icono}
            className={className}
            style={{ width: size, height: size, ...(color ? { color } : {}), ...style }}
            {...resto}
        />
    );
    return Icono;
};

export const Activity = crear(faHeartPulse);
export const AlertCircle = crear(faCircleExclamation);
export const AlertTriangle = crear(faTriangleExclamation);
export const ArrowDown = crear(faArrowDown);
export const ArrowLeft = crear(faArrowLeft);
export const ArrowRight = crear(faArrowRight);
export const ArrowRightLeft = crear(faRightLeft);
export const ArrowUp = crear(faArrowUp);
export const Backpack = crear(faSuitcase);
export const Ban = crear(faBan);
export const BarChart3 = crear(faChartColumn);
export const Bell = crear(faBell);
export const Bomb = crear(faBomb);
export const BookmarkPlus = crear(faBookmark);
export const Bot = crear(faRobot);
export const BrainCircuit = crear(faBrain);
export const Bug = crear(faBug);
export const Building2 = crear(faBuilding);
export const Calendar = crear(faCalendar);
export const CalendarCheck = crear(faCalendarCheck);
export const CalendarDays = crear(faCalendarDays);
export const Camera = crear(faCamera);
export const Check = crear(faCheck);
export const CheckCircle = crear(faCircleCheck);
export const CheckCircle2 = crear(faCircleCheck);
export const Cherry = crear(faAppleWhole);
export const ChevronDown = crear(faChevronDown);
export const ChevronLeft = crear(faChevronLeft);
export const ChevronRight = crear(faChevronRight);
export const ChevronUp = crear(faChevronUp);
export const ChevronsRight = crear(faAnglesRight);
export const CircleDollarSign = crear(faCircleDollarToSlot);
export const Clock = crear(faClock);
export const CloudOff = crear(faCloud);
export const Clover = crear(faClover);
export const Club = crear(faClover);
export const Coffee = crear(faMugHot);
export const Coins = crear(faCoins);
export const Construction = crear(faPersonDigging);
export const Copy = crear(faCopy);
export const Crown = crear(faCrown);
export const Database = crear(faDatabase);
export const Diamond = crear(faDiamond);
export const Dices = crear(faDice);
export const Disc = crear(faCompactDisc);
export const DoorOpen = crear(faDoorOpen);
export const Download = crear(faDownload);
export const Droplet = crear(faDroplet);
export const Dumbbell = crear(faDumbbell);
export const Edit = crear(faPen);
export const Edit2 = crear(faPen);
export const Eye = crear(faEye);
export const EyeOff = crear(faEyeSlash);
export const FileText = crear(faFileLines);
export const Filter = crear(faFilter);
export const Flag = crear(faFlag);
export const Flame = crear(faFire);
export const Folder = crear(faFolder);
export const Frown = crear(faFaceFrown);
export const Gamepad2 = crear(faGamepad);
export const Gem = crear(faGem);
export const Ghost = crear(faGhost);
export const Gift = crear(faGift);
export const Globe = crear(faGlobe);
export const Handshake = crear(faHandshake);
export const Hash = crear(faHashtag);
export const Heart = crear(faHeart);
export const HeartCrack = crear(faHeartCrack);
export const History = crear(faClockRotateLeft);
export const Home = crear(faHouse);
export const Image = crear(faImage);
export const Info = crear(faCircleInfo);
export const KeyRound = crear(faKey);
export const Laugh = crear(faFaceLaugh);
export const Layers = crear(faLayerGroup);
export const Leaf = crear(faLeaf);
export const Lightbulb = crear(faLightbulb);
export const Link2 = crear(faLink);
export const Loader2 = crear(faSpinner);
export const Lock = crear(faLock);
export const LogOut = crear(faRightFromBracket);
export const Mail = crear(faEnvelope);
export const MapPin = crear(faLocationDot);
export const Maximize2 = crear(faUpRightAndDownLeftFromCenter);
export const Medal = crear(faMedal);
export const Meh = crear(faFaceMeh);
export const MessageCircle = crear(faComment);
export const MessageSquare = crear(faMessage);
export const Minus = crear(faMinus);
export const Moon = crear(faMoon);
export const MoreHorizontal = crear(faEllipsis);
export const Move = crear(faUpDownLeftRight);
export const MoveHorizontal = crear(faLeftRight);
export const Music = crear(faMusic);
export const Package = crear(faBox);
export const Paintbrush = crear(faPaintbrush);
export const Palette = crear(faPalette);
export const Pause = crear(faPause);
export const PawPrint = crear(faPaw);
export const Pencil = crear(faPen);
export const PersonStanding = crear(faPerson);
export const PieChart = crear(faChartPie);
export const Play = crear(faPlay);
export const Plus = crear(faPlus);
export const RefreshCcw = crear(faArrowsRotate);
export const RefreshCw = crear(faArrowsRotate);
export const Repeat = crear(faRepeat);
export const RotateCcw = crear(faRotateLeft);
export const RotateCw = crear(faRotateRight);
export const Rss = crear(faRss);
export const Save = crear(faFloppyDisk);
export const Scale = crear(faScaleBalanced);
export const ScanFace = crear(faIdCard);
export const Scissors = crear(faScissors);
export const ScrollText = crear(faScroll);
export const Search = crear(faMagnifyingGlass);
export const Send = crear(faPaperPlane);
export const Server = crear(faServer);
export const Settings = crear(faGear);
export const Share = crear(faShareNodes);
export const Shield = crear(faShieldHalved);
export const ShoppingBag = crear(faBagShopping);
export const SkipForward = crear(faForwardStep);
export const Skull = crear(faSkull);
export const SlidersHorizontal = crear(faSliders);
export const Smile = crear(faFaceSmile);
export const SortAsc = crear(faArrowDownAZ);
export const Spade = crear(faDiamond);
export const Sparkles = crear(faWandMagicSparkles);
export const Star = crear(faStar);
export const Sun = crear(faSun);
export const Sunrise = crear(faCloudSun);
export const Swords = crear(faHandFist);
export const Target = crear(faBullseye);
export const Ticket = crear(faTicket);
export const Timer = crear(faStopwatch);
export const ToggleLeft = crear(faToggleOff);
export const ToggleRight = crear(faToggleOn);
export const Trash2 = crear(faTrash);
export const TrendingDown = crear(faArrowTrendDown);
export const TrendingUp = crear(faArrowTrendUp);
export const Triangle = crear(faCaretUp);
export const Trophy = crear(faTrophy);
export const Undo2 = crear(faRotateLeft);
export const Unlock = crear(faLockOpen);
export const User = crear(faUser);
export const UserMinus = crear(faUserMinus);
export const UserPlus = crear(faUserPlus);
export const Users = crear(faUsers);
export const Utensils = crear(faUtensils);
export const Volume2 = crear(faVolumeHigh);
export const VolumeX = crear(faVolumeXmark);
export const Watch = crear(faClock);
export const Wheat = crear(faWheatAwn);
export const WifiOff = crear(faPlugCircleXmark);
export const X = crear(faXmark);
export const Zap = crear(faBolt);
