export interface Settings {
	persons: PersonSettings[]
}

export interface PersonSettings {
	personId: AAGUID
	name: string
	jokes: string[]
	photos: Photo[]
}

export interface Photo {
	url: string
	width: number
	height: number
}

export const defaultSettings: Settings = {
	persons: [],
}

export default Settings
