export type ThemeMode = 'light' | 'dark' | 'system';
export type WeekStart = 'Monday' | 'Sunday';

export interface AuthAccountInfo {
	uid: string;
	email: string;
	displayName: string;
	isAnonymous: boolean;
}

export interface UserPreferences {
	locale: string;
	themeMode: ThemeMode | string;
	weekStart: WeekStart | string;
}

export interface UserDocument {
	createdAt: Date | null;
	updatedAt: Date | null;
	longestEverCessation: number;
	todayMaxCessation: { value: number; lastUpdated: Date | null } | null;
	preferences: UserPreferences;
	displayName: string;
	email: string;
}

export interface SmokeLogEntry {
	id: string;
	timestamp: Date;
	intervalSincePrevious: number | null;
}

export interface HistoryDayGroup {
	dayKey: string;
	date: Date;
	count: number;
	entries: SmokeLogEntry[];
}
