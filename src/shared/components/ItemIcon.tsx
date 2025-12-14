/**
 * ItemIcon Component - Ported from OpenCTI
 * 
 * Uses the exact same icon mapping as OpenCTI's ItemIcon.tsx
 */

import React from 'react';
import {
  AccountBalanceOutlined,
  BiotechOutlined,
  BugReportOutlined,
  CampaignOutlined,
  CenterFocusStrongOutlined,
  DescriptionOutlined,
  DiamondOutlined,
  DomainOutlined,
  EventOutlined,
  FlagOutlined,
  HelpOutlined,
  MapOutlined,
  PersonOutlined,
  PlaceOutlined,
  PublicOutlined,
  RouterOutlined,
  SpeakerNotesOutlined,
  StorageOutlined,
  SubjectOutlined,
  TranslateOutlined,
  TravelExploreOutlined,
  WebAssetOutlined,
  WifiTetheringOutlined,
  WorkOutline,
  WorkspacesOutlined,
} from '@mui/icons-material';
import {
  AccountMultipleOutline,
  ArchiveOutline,
  Biohazard,
  BriefcaseEyeOutline,
  BriefcaseSearchOutline,
  BriefcaseRemoveOutline,
  ChessKnight,
  CityVariantOutline,
  Fire,
  HexagonOutline,
  LabelOutline,
  LaptopAccount,
  LockPattern,
  ProgressWrench,
  ShieldSearch,
  VectorRadius,
} from 'mdi-material-ui';
import { itemColor } from '../theme/colors';

interface ItemIconProps {
  type?: string | null;
  size?: 'inherit' | 'large' | 'medium' | 'small';
  variant?: string;
  color?: string | null;
  isReversed?: boolean;
}

const ItemIcon: React.FC<ItemIconProps> = ({ 
  type, 
  size = 'medium', 
  variant, 
  color = null, 
  isReversed = false 
}) => {
  let style: React.CSSProperties;
  
  switch (variant) {
    case 'inline':
      style = {
        color: color ?? itemColor(type),
        width: 15,
        height: 15,
        margin: '0 7px 0 0',
        float: 'left',
        paddingTop: 2,
        transform: isReversed ? 'rotate(-90deg)' : 'none',
      };
      break;
    default:
      style = {
        color: color ?? itemColor(type),
        transform: isReversed ? 'rotate(-90deg)' : 'none',
      };
  }

  switch (type?.toLowerCase()) {
    case 'restricted':
    case 'unauthorized':
      return <HelpOutlined style={style} fontSize={size} />;
    case 'global':
      return <PublicOutlined style={style} fontSize={size} />;
    case 'trigger':
      return <CampaignOutlined style={style} fontSize={size} />;
    case 'marking-definition':
      return <CenterFocusStrongOutlined style={style} fontSize={size} />;
    case 'label':
      return <LabelOutline style={style} fontSize={size} />;
    case 'attack-pattern':
      return <LockPattern style={style} fontSize={size} />;
    case 'campaign':
      return <ChessKnight style={style} fontSize={size} />;
    case 'note':
      return <SubjectOutlined style={style} fontSize={size} />;
    case 'observed-data':
      return <WifiTetheringOutlined style={style} fontSize={size} />;
    case 'report':
      return <DescriptionOutlined style={style} fontSize={size} />;
    case 'grouping':
      return <WorkspacesOutlined style={style} fontSize={size} />;
    case 'course-of-action':
      return <ProgressWrench style={style} fontSize={size} />;
    case 'individual':
    case 'user':
      return <PersonOutlined style={style} fontSize={size} />;
    case 'organization':
    case 'identity':
      return <AccountBalanceOutlined style={style} fontSize={size} />;
    case 'sector':
      return <DomainOutlined style={style} fontSize={size} />;
    case 'system':
      return <StorageOutlined style={style} fontSize={size} />;
    case 'indicator':
      return <ShieldSearch style={style} fontSize={size} />;
    case 'infrastructure':
      return <RouterOutlined style={style} fontSize={size} />;
    case 'intrusion-set':
      return <DiamondOutlined style={style} fontSize={size} />;
    case 'city':
      return <CityVariantOutline style={style} fontSize={size} />;
    case 'position':
    case 'location':
      return <PlaceOutlined style={style} fontSize={size} />;
    case 'administrative-area':
      return <MapOutlined style={style} fontSize={size} />;
    case 'country':
      return <FlagOutlined style={style} fontSize={size} />;
    case 'region':
      return <PublicOutlined style={style} fontSize={size} />;
    case 'malware':
      return <Biohazard style={style} fontSize={size} />;
    case 'malware-analysis':
      return <BiotechOutlined style={style} fontSize={size} />;
    case 'threat-actor':
    case 'threat-actor-group':
      return <AccountMultipleOutline style={style} fontSize={size} />;
    case 'threat-actor-individual':
      return <LaptopAccount style={style} fontSize={size} />;
    case 'tool':
      return <WebAssetOutlined style={style} fontSize={size} />;
    case 'vulnerability':
      return <BugReportOutlined style={style} fontSize={size} />;
    case 'incident':
      return <Fire style={style} fontSize={size} />;
    case 'event':
      return <EventOutlined style={style} fontSize={size} />;
    case 'narrative':
      return <SpeakerNotesOutlined style={style} fontSize={size} />;
    case 'language':
      return <TranslateOutlined style={style} fontSize={size} />;
    case 'artifact':
      return <ArchiveOutline style={style} fontSize={size} />;
    case 'case':
      return <WorkOutline style={style} fontSize={size} />;
    case 'case-incident':
      return <BriefcaseEyeOutline style={style} fontSize={size} />;
    case 'case-rfi':
      return <BriefcaseSearchOutline style={style} fontSize={size} />;
    case 'case-rft':
      return <BriefcaseRemoveOutline style={style} fontSize={size} />;
    case 'investigation':
      return <TravelExploreOutlined style={style} fontSize={size} />;
    // Observables
    case 'observable':
    case 'stix-cyber-observable':
    case 'autonomous-system':
    case 'directory':
    case 'domain-name':
    case 'email-addr':
    case 'email-message':
    case 'stixfile':
    case 'x509-certificate':
    case 'ipv4-addr':
    case 'ipv6-addr':
    case 'mac-addr':
    case 'mutex':
    case 'network-traffic':
    case 'process':
    case 'software':
    case 'url':
    case 'user-account':
    case 'windows-registry-key':
    case 'cryptographic-key':
    case 'cryptocurrency-wallet':
    case 'hostname':
    case 'text':
    case 'user-agent':
    case 'bank-account':
    case 'phone-number':
    case 'payment-card':
    case 'credential':
    case 'tracking-number':
    case 'media-content':
      return <HexagonOutline style={style} fontSize={size} />;
    // Relationships
    case 'relationship':
    case 'stix-core-relationship':
      return <VectorRadius style={style} fontSize={size} />;
    default:
      return <HexagonOutline style={style} fontSize={size} />;
  }
};

export default ItemIcon;

