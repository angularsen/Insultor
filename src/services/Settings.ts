export interface PersonSettings {
	personId: AAGUID
	name: string
	jokes: string[]
}

export interface Settings {
	persons: PersonSettings[]
}

export const defaultSettings: Settings = {
	persons: [],
}

export default Settings
