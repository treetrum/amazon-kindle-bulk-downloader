export interface GetDevicesOverviewResponse {
  success: boolean;
  GetDevicesOverview: GetDevicesOverview;
  error?: string;
}

export interface GetDevicesOverview {
  deviceList: DeviceList[];
  devicePromotionOfferDataList: unknown[];
  successful: boolean;
}

export interface DeviceList {
  childDevices: null;
  deviceTypeID: string;
  deviceImageURL: null | string;
  metadata: Metadata;
  isChildDevice: boolean;
  displayCategoryFriendlyName: string;
  lastUsedDate: null;
  childDevice: boolean;
  formattedLastRegisteredDate: string;
  deviceFamily: string;
  deviceIdentificationNumber: null;
  deviceName: string;
  deviceSerialNumber: string;
  lastRegisteredDate: LastRegisteredDate;
  isDefaultDevice: boolean;
  displayCategoryImage: string;
  deviceTypeString: string;
  defaultDevice: boolean;
  customerID: string;
  parentDevice: null;
  deviceClassification: string;
  deviceAccountID: string;
  deviceGroup: null;
  alexaOnDevice: boolean;
}

export interface LastRegisteredDate {
  year: number;
  dayOfYear: number;
  equalNow: boolean;
  weekyear: number;
  chronology: Chronology;
  weekOfWeekyear: number;
  secondOfMinute: number;
  millisOfDay: number;
  monthOfYear: number;
  dayOfWeek: number;
  beforeNow: boolean;
  minuteOfDay: number;
  dayOfMonth: number;
  era: number;
  zone: Zone;
  yearOfCentury: number;
  centuryOfEra: number;
  hourOfDay: number;
  secondOfDay: number;
  yearOfEra: number;
  millis: number;
  minuteOfHour: number;
  millisOfSecond: number;
  afterNow: boolean;
}

export interface Chronology {
  zone: Zone;
}

export interface Zone {
  fixed: boolean;
  id: string;
}

export interface Metadata {
  deviceImageURL?: null | string;
  deviceTypeString: string;
  deviceFamily: string;
  actions?: string[];
  deviceImagePath?: string;
  namespace?: string;
  customDeleteVoiceRecordingMessage?: string;
  customDeleteHistoryMessage?: string;
}
