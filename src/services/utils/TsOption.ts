/** @see https://github.com/fantasyland/fantasy-land#functor */
export interface FunctorNone<T> {
	'fantasy-land/map'<U = T>(f: (value: T) => U): None<U>
}

/** @see https://github.com/fantasyland/fantasy-land#functor */
export interface FunctorSome<T> {
	'fantasy-land/map'<U = T>(f: (value: T) => U): Some<U>
}

/** @see https://github.com/fantasyland/fantasy-land#chain */
export interface ChainNone<T> {
	/* alias for flatMap */
	'fantasy-land/chain'<U = T>(f: (value: T) => Some<U> | None<U>): None<T>
}

/** @see https://github.com/fantasyland/fantasy-land#chain */
export interface ChainSome<T> {
	/* alias for flatMap */
	'fantasy-land/chain'<U = T>(f: (value: T) => Some<U>): Some<U>
	'fantasy-land/chain'<U = T>(f: (value: T) => None<U>): None<T>
}

/** @see https://github.com/fantasyland/fantasy-land#apply */
/** @see https://github.com/fantasyland/fantasy-land#applicative */
export interface ApplicativeNone<T> {
	constructor: {
		'fantasy-land/of': typeof None,
	}
	'fantasy-land/ap'(a: Some<(v: T) => T>): None<T>
}

/** @see https://github.com/fantasyland/fantasy-land#apply */
/** @see https://github.com/fantasyland/fantasy-land#applicative */
export interface ApplicativeSome<T> {
	constructor: {
		'fantasy-land/of': typeof Some,
	}
	'fantasy-land/ap'(a: Some<(v: T) => T>): Some<T>
}

/** @see https://github.com/fantasyland/fantasy-land#applicative */
export interface ApplicativeStatic {
	'fantasy-land/of': typeof Some
}

/** @see https://github.com/fantasyland/fantasy-land#monad */
export interface MonadNone<T> extends ApplicativeNone<T>, FunctorNone<T>, ChainNone<T> {}

/** @see https://github.com/fantasyland/fantasy-land#monad */
export interface MonadSome<T> extends ApplicativeSome<T>, FunctorSome<T>, ChainSome<T> {}

export interface None<T> extends MonadNone<T> {
	flatMap<U = T>(f: (value: T) => Some<U> | None<U>): None<T>
	getOrElse<U extends T>(def: U): U
	isEmpty(): this is None<T>
	map<U = T>(f: (value: T) => U): None<U>
	nonEmpty(): this is Some<T>
	orElse<U extends T>(alternative: None<U>): None<T>
	orElse<U extends T>(alternative: Some<U>): Some<U>
	toString(): string
}

export interface Some<T> extends MonadSome<T> {
	flatMap<U = T>(f: (value: T) => Some<U>): Some<U>
	flatMap<U = T>(f: (value: T) => None<U>): None<T>
	get(): T
	getOrElse<U extends T>(def: U): T
	isEmpty(): this is None<T>
	map<U = T>(f: (value: T) => U): Some<U>
	nonEmpty(): this is Some<T>
	orElse<U extends T>(alternative: None<U>): Some<T>
	orElse<U extends T>(alternative: Some<U>): Some<U>
	toString(): string
}

export type Option<T> = Some<T> | None<T>

export function None<T>(): None<T> {

	const flatMap = <U>(_f: (value: T) => Option<U>): None<U> => None<U>()
	const map = <U>(_f: (value: T) => U): any => none

	const none: None<T> = {
		flatMap,
		'getOrElse': <U extends T>(def: U) => def,
		'isEmpty': () => true,
		map,
		'nonEmpty': () => false,
		'orElse': <U extends T>(alternative: Option<U>): any => alternative,
		'toString': () => 'None',

		// fantasyland
		'constructor': {
			'fantasy-land/of': None,
		},
		'fantasy-land/ap': (_a: Some<(v: T) => T>): any => none,
		'fantasy-land/chain': flatMap,
		'fantasy-land/map': map,
	}

	return none
}

export function Some<T>(value: T): Some<T> {

	const flatMap = <U>(f: (value: T) => Option<U>): any => f(value)
	const map = <U>(f: (value: T) => U): any => Some(f(value))

	const some: Some<T> = {
		flatMap,
		'get': () => value,
		'getOrElse': <U extends T>(def: U): T | U  => value || def,
		'isEmpty': () => false,
		map,
		'nonEmpty': () => true,
		'orElse': <U extends T>(_alternative: Option<U>): any => Some(value),
		'toString': () => `Some(${value})`,

		// fantasyland
		'constructor': {
			'fantasy-land/of': Some,
		},
		'fantasy-land/ap': (a: Some<(v: T) => T>): any => Some(a.get()(value)),
		'fantasy-land/chain': flatMap,
		'fantasy-land/map': map,
	}

	return some
}

export interface OptionStatic {
	'fantasy-land/of': typeof Some
	'fantasy-land/empty'<T>(): None<T>
	'fantasy-land/zero'<T>(): None<T>
	from<T = {}>(value: null | undefined): None<T>
	from<T>(value: T | null | undefined): Option<T>
	from<T>(value: T): Some<T>
}

// tslint:disable-next-line:variable-name
export const Option: OptionStatic = {
	'fantasy-land/of': Some,
	'fantasy-land/empty': <T>() => None<T>(),
	'fantasy-land/zero': <T>() => None<T>(),
	'from': <T>(value: T | null | undefined): any =>
		(value === null || value === undefined) ? None<T>() : Some<T>(value),
}
