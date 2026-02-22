/**
 * @typedef {Object} DirectoryProfile
 * @property {string} uid
 * @property {string} displayName
 * @property {string} handle
 * @property {string} bio
 * @property {string[]} roles
 * @property {string} city
 * @property {string} state
 * @property {string} country
 * @property {string} avatarUrl
 * @property {"public"|"private"} visibility
 */

/**
 * @typedef {Object} VenueListing
 * @property {string} id
 * @property {"venue"} listingType
 * @property {string} title
 * @property {string} city
 * @property {string} state
 * @property {string} address1
 * @property {string} description
 * @property {"approved"|"pending"|"rejected"|"disabled"} status
 */

/**
 * @typedef {Object} KaraokeEvent
 * @property {string} id
 * @property {"event"} listingType
 * @property {string} title
 * @property {number} startsAtMs
 * @property {number} endsAtMs
 * @property {string} city
 * @property {string} state
 * @property {string} venueId
 * @property {string} hostUid
 */

/**
 * @typedef {Object} RoomSession
 * @property {string} id
 * @property {"room_session"} listingType
 * @property {string} title
 * @property {number} startsAtMs
 * @property {number} endsAtMs
 * @property {"public"|"private"} visibility
 * @property {string} hostUid
 * @property {string} venueId
 * @property {string} roomCode
 */

/**
 * @typedef {Object} DirectorySubmission
 * @property {string} submissionId
 * @property {"venue"|"event"|"room_session"} listingType
 * @property {"pending"|"approved"|"rejected"} status
 * @property {string} sourceType
 * @property {Object} payload
 */

/**
 * @typedef {Object} FollowRecord
 * @property {string} id
 * @property {string} followerUid
 * @property {"host"|"venue"|"performer"|"event"|"session"} targetType
 * @property {string} targetId
 */

/**
 * @typedef {Object} CheckinRecord
 * @property {string} checkinId
 * @property {string} uid
 * @property {"host"|"venue"|"performer"|"event"|"session"} targetType
 * @property {string} targetId
 * @property {boolean} isPublic
 * @property {string} note
 */

/**
 * @typedef {Object} ReviewRecord
 * @property {string} reviewId
 * @property {string} uid
 * @property {"host"|"venue"|"performer"|"event"|"session"} targetType
 * @property {string} targetId
 * @property {number} rating
 * @property {string[]} tags
 * @property {string} text
 */

/**
 * @typedef {Object} ModerationDecision
 * @property {string} submissionId
 * @property {"approve"|"reject"} action
 * @property {string} notes
 */

/**
 * @typedef {Object} ExternalIngestionCandidate
 * @property {"venue"|"event"|"room_session"} listingType
 * @property {string} title
 * @property {string} city
 * @property {string} state
 * @property {Object} externalSources
 */

export const DIRECTORY_REVIEW_TAGS = [
  "host_vibe",
  "rotation_speed",
  "song_quality",
  "sound_mix",
  "crowd_energy",
  "welcoming",
  "gear_quality",
  "karaoke_focus",
  "value",
];

