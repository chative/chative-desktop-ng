// https://github.com/difftim/server-docs/blob/master/apis/response.md
// 0	OK
// 1	Invalid parameter
// 2	No permission
// 3	No such group
// 4	No such group member
// 5	Invalid token
// 6	Server Internal Error
// 7	NO SUCH GROUP ANNOUNCEMENT
// 8	GROUP EXISTS
// 9	No Such File
// 10	Group is full or exceeds
// 11	NO_SUCH_USER
// 12	RATE_LIMIT_EXCEEDED
// 13	INVALID_INVITER
// 14	USER_IS_DISABLED
// 15	PUID_IS_REGISTERING
// 16	NUMBER_IS_BINDING_OTHER_PUID
// 17	TEAM_HAS_MEMBERS
// 18	VOTE_IS_CLOSED
// 19	NO SUCH GROUP PIN
// 99	OTHER ERROR
export enum API_STATUS {
  Success = 0,
  InvalidParameter = 1,
  NoPermission = 2,
  NoSuchGroup = 3,
  NoSuchGroupMember = 4,
  InvalidToken = 5,
  ServerInternalError = 6,
  NoSuchGroupAnnouncement = 7,
  GroupAlreadyExists = 8,
  NoSuchFile = 9,
  GroupMemberCountExceeded = 10,
  NoSuchUser = 11,
  RateLimitExceeded = 12,
  InvalidInviter = 13,
  DisabledUser = 14,
  RegisteringPUid = 15,
  NumberIsBindingOtherPUid = 16,
  TeamhasMembers = 17,
  ClosedVote = 18,
  NoSuchGroupPin = 19,
  OtherError = 99,
  InvalidGroupInviteLink = 10120,
  GroupDisabledInviteLink = 10121,
  GroupOnlyAllowsModeratorsInvite = 10122,
  GroupHasAlreadyBeenDisbanded = 10123,
  GroupIsInvalid = 10124,
}
