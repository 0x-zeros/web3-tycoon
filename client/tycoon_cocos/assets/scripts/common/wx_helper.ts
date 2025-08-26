// WeChat Mini Game Helper
// Simplified version for TypeScript conversion

declare var wx: any;
declare var window: any;

interface WxHelper {
    userId?: string;
    BeiId?: string;
    showShareMenu: (bTicket?: boolean) => void;
    share: (awardObj?: any) => boolean;
    shouldEnforceCanvasRenderer: () => boolean;
}

const wx_helper: WxHelper = {
    userId: '0',
    BeiId: '0',

    // 转发
    showShareMenu: (bTicket: boolean = false) => {
        console.log('in wx_helper.showShareMenu');

        if (!wx_helper.userId) {
            wx_helper.userId = '0';
        }
        if (!wx_helper.BeiId) {
            wx_helper.BeiId = '0';
        }

        if (!window.wx) {
            return;
        }

        wx.showShareMenu({
            withShareTicket: bTicket,
            success: (res: any) => {
                console.log('in showShareMenu success');
                console.log(res);
            },
            fail: (res: any) => {
                console.log('in showShareMenu fail');
                console.log(res);
            }
        });
    },

    share: (awardObj?: any): boolean => {
        console.log('in wx_helper.share');

        if (!window.wx) {
            return false;
        }

        const url = game.config?.wx_share_icon || '';
        const queryData = 'shareId=' + wx_helper.userId;

        wx.shareAppMessage({
            title: game.config?.wx_share_title || 'Share Game',
            imageUrl: url,
            query: queryData,
            success: (res: any) => {
                console.log('share success');
                console.log(res);
            },
            fail: (res: any) => {
                console.log('share fail');
                console.log(res);
            }
        });

        return true;
    },

    shouldEnforceCanvasRenderer: (): boolean => {
        // Simplified implementation
        // You can add specific device/browser checks here if needed
        return false;
    }
};

export { wx_helper };
export default wx_helper;