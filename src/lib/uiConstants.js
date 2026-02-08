/**
 * UI Constants - Static Styles & Configurations
 * Extracted to prevent recreation on every component render
 * 
 * Phase 1: Performance Optimization
 */

/**
 * Party Lights CSS Animation for Singer App
 * This is ~500 lines of CSS that was recreated on every SingerApp render
 * Now it's created once and reused
 */
export const PARTY_LIGHTS_STYLE = `
    @keyframes brossTitleFloat {
        0% { transform: translateY(0); opacity: 0.7; }
        50% { transform: translateY(-3px); opacity: 1; }
        100% { transform: translateY(0); opacity: 0.8; }
    }
    @keyframes spotlightDriftA {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        50% { transform: translate3d(12vw, -8vh, 0) scale(1.12); }
    }
    @keyframes spotlightDriftB {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        45% { transform: translate3d(-10vw, 10vh, 0) scale(1.08); }
    }
    @keyframes spotlightDriftC {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        40% { transform: translate3d(8vw, 6vh, 0) scale(1.15); }
    }
    @keyframes spotlightHue {
        0% { filter: blur(20px) saturate(1.15) brightness(0.95); }
        50% { filter: blur(24px) saturate(1.35) brightness(1.05); }
        100% { filter: blur(20px) saturate(1.15) brightness(0.95); }
    }
    @keyframes spotlightPulse {
        0%, 100% { opacity: 0.45; }
        50% { opacity: 0.65; }
    }
    .party-lights {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
    }
    .party-lights .spotlight {
        position: absolute;
        border-radius: 9999px;
        mix-blend-mode: screen;
        filter: blur(22px);
        opacity: 0.55;
        animation: spotlightHue 7s ease-in-out infinite, spotlightPulse 5s ease-in-out infinite;
        will-change: transform, opacity, filter;
    }
    .party-lights .s1 {
        width: 220px;
        height: 220px;
        top: -8%;
        left: -6%;
        background: rgba(0,196,217,0.6);
        animation: spotlightDriftA 8s linear infinite, spotlightHue 6.5s ease-in-out infinite, spotlightPulse 4.8s ease-in-out infinite;
        animation-delay: -1.2s, -0.8s, -0.4s;
    }
    .party-lights .s2 {
        width: 260px;
        height: 260px;
        top: 15%;
        right: -8%;
        background: rgba(255,103,182,0.6);
        animation: spotlightDriftB 9s linear infinite, spotlightHue 7.8s ease-in-out infinite, spotlightPulse 5.6s ease-in-out infinite;
        animation-delay: -1.8s, -2.2s, -1.1s;
    }
    .party-lights .s3 {
        width: 200px;
        height: 200px;
        bottom: 6%;
        left: 8%;
        background: rgba(0,196,217,0.5);
        animation: spotlightDriftC 8.5s linear infinite, spotlightHue 6.2s ease-in-out infinite, spotlightPulse 4.4s ease-in-out infinite;
        animation-delay: -2.6s, -1.4s, -0.9s;
    }
    .party-lights .s4 {
        width: 240px;
        height: 240px;
        bottom: -8%;
        right: 6%;
        background: rgba(255,103,182,0.45);
        animation: spotlightDriftA 10s linear infinite, spotlightHue 7s ease-in-out infinite, spotlightPulse 5.2s ease-in-out infinite;
        animation-delay: -3.2s, -2.4s, -1.5s;
    }
    .party-lights .s5 {
        width: 190px;
        height: 190px;
        top: 45%;
        left: 55%;
        background: rgba(0,196,217,0.45);
        animation: spotlightDriftB 7.8s linear infinite, spotlightHue 6.1s ease-in-out infinite, spotlightPulse 4.9s ease-in-out infinite;
        animation-delay: -2.1s, -1.2s, -0.7s;
    }
    .party-lights .s6 {
        width: 210px;
        height: 210px;
        top: 60%;
        left: 15%;
        background: rgba(255,103,182,0.45);
        animation: spotlightDriftC 9.5s linear infinite, spotlightHue 7.3s ease-in-out infinite, spotlightPulse 5.9s ease-in-out infinite;
        animation-delay: -3.8s, -3s, -1.9s;
    }
    .party-lights .s7 {
        width: 260px;
        height: 260px;
        top: 6%;
        left: 55%;
        background: rgba(0,196,217,0.42);
        animation: spotlightDriftA 7.2s linear infinite, spotlightHue 5.8s ease-in-out infinite, spotlightPulse 4.2s ease-in-out infinite;
        animation-delay: -2.8s, -2.1s, -1.2s;
    }
    .party-lights .s8 {
        width: 230px;
        height: 230px;
        bottom: 18%;
        right: 18%;
        background: rgba(255,103,182,0.46);
        animation: spotlightDriftB 8.4s linear infinite, spotlightHue 6.4s ease-in-out infinite, spotlightPulse 4.7s ease-in-out infinite;
        animation-delay: -3.4s, -2.5s, -1.6s;
    }
    .party-lights .s9 {
        width: 200px;
        height: 200px;
        top: 32%;
        right: 6%;
        background: rgba(0,196,217,0.4);
        animation: spotlightDriftC 7.6s linear infinite, spotlightHue 5.9s ease-in-out infinite, spotlightPulse 4.1s ease-in-out infinite;
        animation-delay: -2.2s, -1.6s, -0.9s;
    }
    .party-lights .s10 {
        width: 240px;
        height: 240px;
        bottom: -6%;
        left: 28%;
        background: rgba(255,103,182,0.42);
        animation: spotlightDriftA 8.8s linear infinite, spotlightHue 6.7s ease-in-out infinite, spotlightPulse 5.3s ease-in-out infinite;
        animation-delay: -4.2s, -3.1s, -2s;
    }
    .party-lights.alt .spotlight {
        opacity: 0.45;
        filter: blur(26px);
    }
    .party-lights.third .spotlight {
        opacity: 0.35;
        filter: blur(28px);
    }
`;

/**
 * Singer App Config
 */
export const SINGER_APP_CONFIG = {
    DEFAULT_EMOJI: '😀',
    BRAND_ICON: 'https://beauross.com/wp-content/uploads/Icon-Reversed-gradient-small.png'
};

/**
 * Host App Config
 */
export const HOST_APP_CONFIG = {
    VERSION: "v21.12.5-HOST-FINAL-ICONS",
    STORM_SEQUENCE: {
        approachMs: 15000,
        peakMs: 20000,
        passMs: 12000,
        clearMs: 6000
    },
    STROBE_COUNTDOWN_MS: 5000,
    STROBE_ACTIVE_MS: 15000
};
