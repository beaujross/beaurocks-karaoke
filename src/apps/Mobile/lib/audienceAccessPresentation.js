import { AUDIENCE_ACCESS_MODES } from '../../../lib/roomMonetization.js';

export const shouldSimplifyFestivalSupportAccess = ({
    audienceAccessMode = AUDIENCE_ACCESS_MODES.account,
    roomSupportOffer = null,
    openCustomEmoji = false,
    openPremiumReactions = false,
    audienceBrandTitle = '',
} = {}) => {
    const allowsDonationAccess = !!roomSupportOffer && [
        AUDIENCE_ACCESS_MODES.donation,
        AUDIENCE_ACCESS_MODES.emailOrDonation,
    ].includes(audienceAccessMode);
    return allowsDonationAccess
        && openCustomEmoji
        && openPremiumReactions
        && /aahf|festival/i.test(String(audienceBrandTitle || '').trim());
};

export const buildAudienceAccessPresentation = ({
    simplifyFestivalSupportAccess = false,
    allowsDonationAccess = false,
    isDonationFirstAccess = false,
    supportCtaLabel = 'Support',
    simpleEmailCaptureMode = false,
    isCustomAudienceBrand = false,
    audienceBrandTitle = 'BeauRocks',
    supporterAccessLabel = 'Supporter Access',
    premiumPerksLabel = 'premium perks',
} = {}) => {
    const accessActionLabel = simplifyFestivalSupportAccess
        ? 'Continue with Email'
        : allowsDonationAccess
            ? (isDonationFirstAccess ? supportCtaLabel : 'Support or Continue')
            : (simpleEmailCaptureMode ? 'Submit Email' : (isCustomAudienceBrand ? `Continue with ${audienceBrandTitle}` : 'Continue with Email'));
    const accessConnectedLabel = simplifyFestivalSupportAccess
        ? 'Email Access Ready'
        : allowsDonationAccess
            ? `${supporterAccessLabel} Ready`
            : (isCustomAudienceBrand ? `${audienceBrandTitle} Access Ready` : 'Email Access Ready');
    const audienceAccessHeadline = simplifyFestivalSupportAccess
        ? 'Continue with Email'
        : allowsDonationAccess
            ? (isDonationFirstAccess ? `Support ${audienceBrandTitle}` : `Support ${audienceBrandTitle} or continue with email`)
            : (simpleEmailCaptureMode ? 'Submit Email' : 'Continue with Email');
    const audienceAccessBody = simplifyFestivalSupportAccess
        ? 'Email is optional but recommended if you want to reconnect, keep your profile in sync, and carry your history forward. AAHF support moments can stay separate from your karaoke join flow.'
        : allowsDonationAccess
            ? (
                isDonationFirstAccess
                    ? `Givebutter support can unlock ${supporterAccessLabel.toLowerCase()} perks, featured reactions, and room moments without interrupting the night.`
                    : `You can unlock ${supporterAccessLabel.toLowerCase()} perks by supporting the fundraiser, or keep the standard email path for profile sync and cross-room history.`
            )
            : (simpleEmailCaptureMode
                ? 'Enter your email for this room only. No account creation or sign-in link is required.'
                : `Enter your email and we will send a secure sign-in link. Open the link on this device to reconnect, unlock ${premiumPerksLabel}, and carry your history forward.`);

    return {
        accessActionLabel,
        accessConnectedLabel,
        audienceAccessHeadline,
        audienceAccessBody,
    };
};
