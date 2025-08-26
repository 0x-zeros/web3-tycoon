import { _decorator, Label, Font, log} from 'cc';
import i18n from './i18n';

const { ccclass, property } = _decorator;

// declare global {
//     var game: any;
//     var CC_EDITOR: boolean;
// }

@ccclass('LabelLocalized')
export class LabelLocalized extends Label {

    @property({
        multiline: true,
        tooltip: 'Enter i18n key here',
    })
    get textKey(): string {
        return this._textKey;
    }
    set textKey(value: string) {
        this._textKey = value;
        this.string = this.localizedString;
    }

    @property
    get localizedString(): string {
        if (!this.textKey) {
            return '';
        }
        
        // Build interpolation options
        const opt: Record<string, any> = {};
        if (this._opt) {
            opt.p0 = this._opt;
        }
        
        try {
            return i18n.t(this.textKey, opt);
        } catch (error) {
            log('Error in localizedString:', error);
            return this.textKey; // Fallback to key itself
        }
    }
    set localizedString(value: string) {
        this.textKey = value;
        if (EDITOR) {
            console.warn('Please set label text key in Text Key property.');
        }
    }

    @property
    get opt(): string {
        return this._opt;
    }
    set opt(value: string) {
        this._opt = value;
        this.refresh();
    }

    private _textKey: string = 'TEXT_KEY';
    private _opt: string = 'p0';
    private specialFont: Font | null = null;

    onLoad() {
        this.specialFont = this.font;
        
        // Initialize with localized text
        this.refresh();

        // Listen for language change events
        game.eventTarget.on('changeLanguage', this.changeLanguage, this);
    }

    onDestroy() {
        // Clean up event listeners
        game.eventTarget.off('changeLanguage', this.changeLanguage, this);
    }


    changeLanguage() {
        this.refresh();
    }

    refresh() {
        // Update font if needed
        this.changeFont();

        // Update text with localized string
        const str = this.localizedString;
        if (str !== undefined && str !== null) {
            this.string = str;
        }
    }

    changeFont() {
        // Font change logic - can be customized based on language
        if (this.specialFont && typeof game !== 'undefined' && game?.player?.setting) {
            const currentLang = game.player.setting.language;
            
            if (currentLang === 'zh' || currentLang === 'en') {
                this.useSystemFont = false;
                this.font = this.specialFont;
                log('Set custom font for language:', currentLang);
            } else {
                this.useSystemFont = true;
                this.fontFamily = 'Arial';
                this.font = null;
                log('Set system font for language:', currentLang);
            }
        }
    }

}