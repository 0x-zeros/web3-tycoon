//     (c) 2012-2016 Airbnb, Inc.
//
//     polyglot.js may be freely distributed under the terms of the BSD
//     license. For all licensing information, details, and documention:
//     http://airbnb.github.com/polyglot.js
//
//
// Polyglot.js is an I18n helper library written in JavaScript, made to
// work both in the browser and in Node. It provides a simple solution for
// interpolation and pluralization, based off of Airbnb's
// experience adding I18n functionality to its Backbone.js and Node apps.
//
// Polylglot is agnostic to your translation backend. It doesn't perform any
// translation; it simply gives you a way to manage translated phrases from
// your client- or server-side JavaScript application.

interface PolyglotOptions {
    phrases?: Record<string, any>;
    locale?: string;
    allowMissing?: boolean;
    warn?: (message: string) => void;
}

interface TranslationOptions {
    _?: string;
    smart_count?: number;
    [key: string]: any;
}

type PluralRule = (n: number) => number;

// ### Polyglot class constructor
export class Polyglot {
    static VERSION = '1.0.0';
    
    private phrases: Record<string, string> = {};
    private currentLocale: string = 'en';
    private allowMissing: boolean = false;
    private warn: (message: string) => void;

    constructor(options: PolyglotOptions = {}) {
        this.phrases = {};
        this.extend(options.phrases || {});
        this.currentLocale = options.locale || 'en';
        this.allowMissing = !!options.allowMissing;
        this.warn = options.warn || this.defaultWarn;
    }

    // ### polyglot.locale([locale])
    //
    // Get or set locale. Internally, Polyglot only uses locale for pluralization.
    locale(newLocale?: string): string {
        if (newLocale) this.currentLocale = newLocale;
        return this.currentLocale;
    }

    // ### polyglot.extend(phrases)
    //
    // Use `extend` to tell Polyglot how to translate a given key.
    //
    //     polyglot.extend({
    //       "hello": "Hello",
    //       "hello_name": "Hello, %{name}"
    //     });
    //
    // The key can be any string.  Feel free to call `extend` multiple times;
    // it will override any phrases with the same key, but leave existing phrases
    // untouched.
    //
    // It is also possible to pass nested phrase objects, which get flattened
    // into an object with the nested keys concatenated using dot notation.
    //
    //     polyglot.extend({
    //       "nav": {
    //         "hello": "Hello",
    //         "hello_name": "Hello, %{name}",
    //         "sidebar": {
    //           "welcome": "Welcome"
    //         }
    //       }
    //     });
    //
    //     console.log(polyglot.phrases);
    //     // {
    //     //   'nav.hello': 'Hello',
    //     //   'nav.hello_name': 'Hello, %{name}',
    //     //   'nav.sidebar.welcome': 'Welcome'
    //     // }
    //
    // `extend` accepts an optional second argument, `prefix`, which can be used
    // to prefix every key in the phrases object with some string, using dot
    // notation.
    //
    //     polyglot.extend({
    //       "hello": "Hello",
    //       "hello_name": "Hello, %{name}"
    //     }, "nav");
    //
    //     console.log(polyglot.phrases);
    //     // {
    //     //   'nav.hello': 'Hello',
    //     //   'nav.hello_name': 'Hello, %{name}'
    //     // }
    //
    // This feature is used internally to support nested phrase objects.
    extend(morePhrases: Record<string, any>, prefix?: string): void {
        for (const key in morePhrases) {
            if (morePhrases.hasOwnProperty(key)) {
                let phrase = morePhrases[key];
                let fullKey = prefix ? prefix + '.' + key : key;
                if (typeof phrase === 'object' && phrase !== null) {
                    this.extend(phrase, fullKey);
                } else {
                    this.phrases[fullKey] = phrase;
                }
            }
        }
    }

    // ### polyglot.unset(phrases)
    // Use `unset` to selectively remove keys from a polyglot instance.
    //
    //     polyglot.unset("some_key");
    //     polyglot.unset({
    //       "hello": "Hello",
    //       "hello_name": "Hello, %{name}"
    //     });
    //
    // The unset method can take either a string (for the key), or an object hash with
    // the keys that you would like to unset.
    unset(morePhrases: string | Record<string, any>, prefix?: string): void {
        if (typeof morePhrases === 'string') {
            delete this.phrases[morePhrases];
        } else {
            for (const key in morePhrases) {
                if (morePhrases.hasOwnProperty(key)) {
                    let phrase = morePhrases[key];
                    let fullKey = prefix ? prefix + '.' + key : key;
                    if (typeof phrase === 'object' && phrase !== null) {
                        this.unset(phrase, fullKey);
                    } else {
                        delete this.phrases[fullKey];
                    }
                }
            }
        }
    }

    // ### polyglot.clear()
    //
    // Clears all phrases. Useful for special cases, such as freeing
    // up memory if you have lots of phrases but no longer need to
    // perform any translation. Also used internally by `replace`.
    clear(): void {
        this.phrases = {};
    }

    // ### polyglot.replace(phrases)
    //
    // Completely replace the existing phrases with a new set of phrases.
    // Normally, just use `extend` to add more phrases, but under certain
    // circumstances, you may want to make sure no old phrases are lying around.
    replace(newPhrases: Record<string, any>): void {
        this.clear();
        this.extend(newPhrases);
    }

    // ### polyglot.t(key, options)
    //
    // The most-used method. Provide a key, and `t` will return the
    // phrase.
    //
    //     polyglot.t("hello");
    //     => "Hello"
    //
    // The phrase value is provided first by a call to `polyglot.extend()` or
    // `polyglot.replace()`.
    //
    // Pass in an object as the second argument to perform interpolation.
    //
    //     polyglot.t("hello_name", {name: "Spike"});
    //     => "Hello, Spike"
    //
    // If you like, you can provide a default value in case the phrase is missing.
    // Use the special option key "_" to specify a default.
    //
    //     polyglot.t("i_like_to_write_in_language", {
    //       _: "I like to write in %{language}.",
    //       language: "JavaScript"
    //     });
    //     => "I like to write in JavaScript."
    //
    t(key: string, options?: TranslationOptions | number): string {
        let phrase: string;
        let result: string;
        const opts: TranslationOptions = options == null ? {} : 
            typeof options === 'number' ? { smart_count: options } : options;

        if (typeof this.phrases[key] === 'string') {
            phrase = this.phrases[key];
        } else if (typeof opts._ === 'string') {
            phrase = opts._;
        } else if (this.allowMissing) {
            phrase = key;
        } else {
            this.warn('Missing translation for key: "' + key + '"');
            result = key;
        }

        if (typeof phrase === 'string') {
            const clonedOpts = this.clone(opts);
            result = this.choosePluralForm(phrase, this.currentLocale, clonedOpts.smart_count);
            result = this.interpolate(result, clonedOpts);
        }

        return result!;
    }

    // ### polyglot.has(key)
    //
    // Check if polyglot has a translation for given key
    has(key: string): boolean {
        return key in this.phrases;
    }

    // #### Pluralization methods
    // The string that separates the different phrase possibilities.
    private static readonly DELIMITER = '||||';

    // Mapping from pluralization group plural logic.
    private static readonly PLURAL_TYPES: Record<string, PluralRule> = {
        chinese: (n: number) => 0,
        german: (n: number) => n !== 1 ? 1 : 0,
        french: (n: number) => n > 1 ? 1 : 0,
        russian: (n: number) => n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2,
        czech: (n: number) => (n === 1) ? 0 : (n >= 2 && n <= 4) ? 1 : 2,
        polish: (n: number) => (n === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2),
        icelandic: (n: number) => (n % 10 !== 1 || n % 100 === 11) ? 1 : 0
    };

    // Mapping from pluralization group to individual locales.
    private static readonly PLURAL_TYPE_TO_LANGUAGES: Record<string, string[]> = {
        chinese: ['fa', 'id', 'ja', 'ko', 'lo', 'ms', 'th', 'tr', 'zh'],
        german: ['da', 'de', 'en', 'es', 'fi', 'el', 'he', 'hu', 'it', 'nl', 'no', 'pt', 'sv'],
        french: ['fr', 'tl', 'pt-br'],
        russian: ['hr', 'ru'],
        czech: ['cs', 'sk'],
        polish: ['pl'],
        icelandic: ['is']
    };

    private langToTypeMap(): Record<string, string> {
        const ret: Record<string, string> = {};
        for (const type in Polyglot.PLURAL_TYPE_TO_LANGUAGES) {
            if (Polyglot.PLURAL_TYPE_TO_LANGUAGES.hasOwnProperty(type)) {
                const langs = Polyglot.PLURAL_TYPE_TO_LANGUAGES[type];
                for (const lang of langs) {
                    ret[lang] = type;
                }
            }
        }
        return ret;
    }

    // Trim a string.
    private trim(str: string): string {
        return str.replace(/^\s+|\s+$/g, '');
    }

    // Based on a phrase text that contains `n` plural forms separated
    // by `DELIMITER`, a `locale`, and a `count`, choose the correct
    // plural form, or none if `count` is `null`.
    private choosePluralForm(text: string, locale: string, count?: number): string {
        if (count != null && text) {
            const texts = text.split(Polyglot.DELIMITER);
            const chosenText = texts[this.pluralTypeIndex(locale, count)] || texts[0];
            return this.trim(chosenText);
        }
        return text;
    }

    private pluralTypeName(locale: string): string {
        const langToPluralType = this.langToTypeMap();
        return langToPluralType[locale] || langToPluralType.en;
    }

    private pluralTypeIndex(locale: string, count: number): number {
        return Polyglot.PLURAL_TYPES[this.pluralTypeName(locale)](count);
    }

    // ### interpolate
    //
    // Does the dirty work. Creates a `RegExp` object for each
    // interpolation placeholder.
    private interpolate(phrase: string, options: TranslationOptions): string {
        const dollarRegex = /\$/g;
        const dollarBillsYall = '$$$$';
        
        for (const arg in options) {
            if (arg !== '_' && options.hasOwnProperty(arg)) {
                // Ensure replacement value is escaped to prevent special $-prefixed
                // regex replace tokens. the "$$$$" is needed because each "$" needs to
                // be escaped with "$" itself, and we need two in the resulting output.
                let replacement = options[arg];
                if (typeof replacement === 'string') {
                    replacement = replacement.replace(dollarRegex, dollarBillsYall);
                }
                // We create a new `RegExp` each time instead of using a more-efficient
                // string replace so that the same argument can be replaced multiple times
                // in the same phrase.
                phrase = phrase.replace(new RegExp('%\\{' + arg + '\\}', 'g'), replacement);
            }
        }
        return phrase;
    }

    // ### warn
    //
    // Provides a warning in the console if a phrase key is missing.
    private defaultWarn(message: string): void {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('WARNING: ' + message);
        }
    }

    // ### clone
    //
    // Clone an object.
    private clone(source: TranslationOptions): TranslationOptions {
        const ret: TranslationOptions = {};
        for (const prop in source) {
            if (source.hasOwnProperty(prop)) {
                ret[prop] = source[prop];
            }
        }
        return ret;
    }
}

export default Polyglot;