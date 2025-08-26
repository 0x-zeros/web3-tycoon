// Test file for the i18n system
import { log } from 'cc';
import i18n from './i18n';

export class I18nTest {
    static runTests(): void {
        log('Running i18n system tests...');

        // Test 1: Basic translation
        try {
            const hello = i18n.t('HELLO');
            log('Test 1 - Basic translation:', hello);
            console.assert(hello !== 'HELLO', 'Basic translation should work');
        } catch (error) {
            log('Test 1 failed:', error);
        }

        // Test 2: Language switching
        try {
            log('Test 2 - Language switching:');
            
            // Switch to Chinese
            i18n.init('zh');
            const helloZh = i18n.t('HELLO');
            log('Chinese Hello:', helloZh);
            
            // Switch to English
            i18n.init('en');
            const helloEn = i18n.t('HELLO');
            log('English Hello:', helloEn);
            
            // Switch to Japanese
            i18n.init('jp');
            const helloJp = i18n.t('HELLO');
            log('Japanese Hello:', helloJp);
            
            console.assert(helloZh !== helloEn, 'Languages should be different');
        } catch (error) {
            log('Test 2 failed:', error);
        }

        // Test 3: Interpolation
        try {
            log('Test 3 - Interpolation:');
            i18n.init('en');
            const scoreText = i18n.t('SCORE_FORMAT', { score: 1000 });
            log('Score with interpolation:', scoreText);
            console.assert(scoreText.includes('1000'), 'Interpolation should work');
        } catch (error) {
            log('Test 3 failed:', error);
        }

        // Test 4: Missing key handling
        try {
            log('Test 4 - Missing key handling:');
            const missingText = i18n.t('NON_EXISTENT_KEY');
            log('Missing key result:', missingText);
            console.assert(missingText === 'NON_EXISTENT_KEY', 'Should return key for missing translations');
        } catch (error) {
            log('Test 4 failed:', error);
        }

        // Test 5: Check if key exists
        try {
            log('Test 5 - Key existence check:');
            const existsHello = i18n.has('HELLO');
            const existsMissing = i18n.has('NON_EXISTENT_KEY');
            log('HELLO exists:', existsHello);
            log('NON_EXISTENT_KEY exists:', existsMissing);
            console.assert(existsHello === true, 'HELLO should exist');
            console.assert(existsMissing === false, 'NON_EXISTENT_KEY should not exist');
        } catch (error) {
            log('Test 5 failed:', error);
        }

        // Test 6: Get current language
        try {
            log('Test 6 - Current language:');
            const currentLang = i18n.getCurrentLanguage();
            log('Current language:', currentLang);
            console.assert(typeof currentLang === 'string', 'Should return a string');
        } catch (error) {
            log('Test 6 failed:', error);
        }

        log('i18n system tests completed!');
    }

    static testAllLanguages(): void {
        log('Testing all language packs...');
        
        const languages = ['zh', 'en', 'jp', 'tw'];
        const testKeys = ['HELLO', 'START', 'GAME_OVER', 'SCORE', 'SETTINGS'];
        
        languages.forEach(lang => {
            log(`\n--- Testing ${lang} ---`);
            i18n.init(lang);
            
            testKeys.forEach(key => {
                const translation = i18n.t(key);
                log(`${key}: ${translation}`);
            });
        });
        
        log('All language tests completed!');
    }

    static testInterpolation(): void {
        log('Testing interpolation features...');
        
        i18n.init('en');
        
        // Test score format
        const score = i18n.t('SCORE_FORMAT', { score: 9999 });
        log('Score format:', score);
        
        // Test level format
        const level = i18n.t('LEVEL_FORMAT', { level: 5 });
        log('Level format:', level);
        
        // Test time left
        const timeLeft = i18n.t('TIME_LEFT', { time: 30 });
        log('Time left:', timeLeft);
        
        // Test combo
        const combo = i18n.t('COMBO_FORMAT', { combo: 10 });
        log('Combo format:', combo);
        
        // Test accuracy
        const accuracy = i18n.t('ACCURACY_FORMAT', { accuracy: 95.5 });
        log('Accuracy format:', accuracy);
        
        log('Interpolation tests completed!');
    }
}