export function error(err: Error): string {
	return err.stack ? err.stack : `${err.name}: ${err.message}`
}
