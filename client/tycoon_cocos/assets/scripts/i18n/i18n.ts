import { log, sys } from 'cc';
import Polyglot from './polyglot';
import zhData from '../../data/i18n/zh';
import enData from '../../data/i18n/en';
import jpData from '../../data/i18n/jp';
import twData from '../../data/i18n/tw';

// Language data interfaces
interface LanguageData {
    [key: string]: string;
}

// Supported languages
type SupportedLanguage = 'zh' | 'en' | 'jp' | 'tw';

// Translation options interface
interface TranslationOptions {
    [key: string]: any;
}

// I18n class for managing internationalization
class I18nManager {
    private static instance: I18nManager;
    private polyglot: Polyglot;
    private currentLanguage: string = 'en';

    constructor() {
        const data = this.loadData(sys.language);
        this.polyglot = new Polyglot({ phrases: data, allowMissing: true });
    }

    static getInstance(): I18nManager {
        if (!I18nManager.instance) {
            I18nManager.instance = new I18nManager();
        }
        return I18nManager.instance;
    }

    /**
     * Load language data based on language code
     * @param language - Language code (zh, en, jp, tw)
     * @returns Language data object
     */
    private loadData(language: string): LanguageData {
        log('i18n, loadData, language = ', language);
        
        let data: LanguageData = {};
        
        switch (language) {
            case 'zh':
                data = zhData;
                break;
            case 'jp':
                data = jpData;
                break;
            case 'tw':
                data = twData;
                break;
            default:
                data = enData;
                break;
        }

        return data;
    }

    /**
     * Get default language data as fallback
     */
    private getDefaultData(): LanguageData {
        return {
            'TEXT_KEY': 'Default Text',
            'HELLO': 'Hello',
            'WELCOME': 'Welcome',
            'START': 'Start',
            'PAUSE': 'Pause',
            'RESUME': 'Resume',
            'GAME_OVER': 'Game Over',
            'SCORE': 'Score',
            'LEVEL': 'Level',
            'SETTINGS': 'Settings',
            'SOUND': 'Sound',
            'MUSIC': 'Music',
            'LANGUAGE': 'Language'
        };
    }

    /**
     * Initialize or switch language during runtime
     * @param language - The language code to switch to
     */
    init(language: string): void {
        log('i18n init, switching to language:', language);
        this.currentLanguage = language;
        const data = this.loadData(language);
        this.polyglot.replace(data);
    }

    /**
     * Get current language
     */
    getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    /**
     * Translate a text key to localized string
     * @param key - The text key to translate
     * @param options - Optional interpolation options
     * @returns Localized string
     * 
     * @example
     * // Basic usage
     * const myText = i18n.t('MY_TEXT_KEY');
     * 
     * // With interpolation
     * // if your data source is defined as
     * // {"hello_name": "Hello, %{name}"}
     * // you can use:
     * const greetingText = i18n.t('hello_name', {name: 'nantas'}); // Hello, nantas
     */
    t(key: string, options?: TranslationOptions): string {
        if (!key) {
            log('Warning: Empty key provided to i18n.t()');
            return '';
        }

        try {
            const result = this.polyglot.t(key, options);
            return result;
        } catch (error) {
            log('Error translating key:', key, 'Error:', error);
            return key; // Return the key itself as fallback
        }
    }

    /**
     * Check if a translation exists for the given key
     * @param key - The text key to check
     * @returns True if translation exists
     */
    has(key: string): boolean {
        return this.polyglot.has(key);
    }

    /**
     * Add or update translations
     * @param phrases - Object containing key-value pairs to add
     * @param prefix - Optional prefix for keys
     */
    extend(phrases: LanguageData, prefix?: string): void {
        this.polyglot.extend(phrases, prefix);
    }

    /**
     * Get all available phrases (for debugging)
     */
    getAllPhrases(): Record<string, string> {
        return (this.polyglot as any).phrases;
    }
}

// Create singleton instance
const i18nManager = I18nManager.getInstance();

// Export the interface that matches the original module.exports format
const i18n = {
    /**
     * This method allows you to switch language during runtime
     * @param language - the language specific data file name, such as 'zh' to load 'zh.ts'
     */
    init(language: string): void {
        i18nManager.init(language);
    },

    /**
     * This method takes a text key as input, and returns the localized string
     * @param key - The text key to translate
     * @param opt - Optional interpolation options
     * @returns Localized string
     */
    t(key: string, opt?: TranslationOptions): string {
        return i18nManager.t(key, opt);
    },

    /**
     * Check if a translation exists for the given key
     */
    has(key: string): boolean {
        return i18nManager.has(key);
    },

    /**
     * Get current language
     */
    getCurrentLanguage(): string {
        return i18nManager.getCurrentLanguage();
    },

    /**
     * Add or update translations
     */
    extend(phrases: LanguageData, prefix?: string): void {
        i18nManager.extend(phrases, prefix);
    }
};

export default i18n;
export type { I18nManager, LanguageData, SupportedLanguage, TranslationOptions };