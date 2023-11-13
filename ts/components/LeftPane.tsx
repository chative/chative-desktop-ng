import React, { createRef } from 'react';
import { AutoSizer, List } from 'react-virtualized';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
  ClickEvent as ListItemClickEvent,
} from './ConversationListItem';
import { PropsData as SearchResultsProps } from './SearchResults';

import SearchResults from './SearchResults';

import { LocalizerType } from '../types/Util';
import { MeetingsStateType } from '../state/ducks/conversations';

import { ContactListItem } from './ContactListItem';
import ChatFolders from './globalComponents/ChatFolders';
import { ConversationListInstantMeetingItem } from './ConversationListInstantMeetingItem';
import { FullWebViewDialog } from './webView/FullWebViewDialog';
import { isLinux } from '../OS';
export interface Props {
  meetings?: MeetingsStateType;
  conversations?: Array<ConversationListItemPropsType>;
  archivedConversations?: Array<ConversationListItemPropsType>;
  searchResults?: SearchResultsProps;
  showArchived?: boolean;
  ourNumber: any;

  i18n: LocalizerType;

  // Action Creators
  startNewConversation: (
    query: string,
    options: { regionCode: string }
  ) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  showArchivedConversations: () => void;
  showInbox: () => void;
  deleteMessages: (id: string, type: string, deleteInFolder?: boolean) => void;
  conversationLeaveGroup: (id: string) => void;
  conversationDisbandGroup: (id: string) => void;
  conversationStick: (id: string, stick: boolean) => void;
  conversationMute: (id: string, mute: boolean) => void;
  // Render Props
  renderMainHeader: () => JSX.Element;
  isArchived: boolean;
  conversationArchived: (id: string) => void;
}
export interface State {
  listStyle: string;
  chatFolderStyle: string;
  chatFolders: Array<ChatFolderType>;
  version: number;
  maxFolderCount: number;
  showChatFolder: boolean;
  showChatFolderBar: boolean;
  operationType: string;
  currentFolder: string;
  currentEditFolder: any;
  contact: Array<any>;

  currentCheckConversation: any;
  checkConversationInFolder: any;
  conversationRef: any;
  showWebview: boolean;
  webviewHttpUrl: string;
  webviewAppId: string;

  currentUnreadIndex: number;
  shownUnreadIndex: number | undefined;

  showChatOperationMenu: boolean;
}
type ChatFolderType = {
  name: string;
  cIds: Array<any>;
  conditions?: any;
  type?: any;
};
// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

const FULL_VIEW_STATUS_DICTIONARY = {
  showChatFolder: false,
  showWebview: false,
};

const NOTIFICATION_TYPE = [
  {
    type: 0,
    i18nKey: 'notifyAll',
  },
  {
    type: 1,
    i18nKey: 'notifyAtMe',
  },
  {
    type: 2,
    i18nKey: 'notifyNone',
  },
];

export class LeftPane extends React.Component<Props, State> {
  public listScrollTimer: any | undefined;

  public chatFolderRef = createRef<any>();
  public folderBarRef: React.RefObject<HTMLDivElement>;

  public constructor(props: Props) {
    super(props);
    // this.captureListBound = this.captureList.bind(this);
    this.listScrollTimer = 0;
    this.folderBarRef = createRef();
    this.state = {
      listStyle: 'overlay',
      chatFolderStyle: 'none',

      // chat folders state
      chatFolders: [] as Array<ChatFolderType>,
      version: 0,
      maxFolderCount: 10,
      contact: [] as Array<any>,
      showChatFolder: false,
      showChatFolderBar: false,
      operationType: '',
      currentFolder: 'all_conversation_unique',
      currentEditFolder: undefined,
      checkConversationInFolder: undefined,
      currentCheckConversation: undefined,
      conversationRef: undefined,
      showWebview: false,
      webviewHttpUrl: '',
      webviewAppId: '',

      currentUnreadIndex: 0,
      shownUnreadIndex: undefined,

      showChatOperationMenu: false,
    };
  }

  public getInstantMeetings = () => {
    const result: any = [];
    const { meetings, conversations } = this.props;
    if (!meetings) {
      return result;
    }

    const isConversationExist = (id: string) => {
      if (!conversations) {
        return false;
      }
      for (let i = 0; i < conversations.length; i += 1) {
        if (conversations[i].id === id) {
          return true;
        }
      }
      return false;
    };

    const keys = Object.keys(meetings);
    for (let i = 0; i < keys.length; i += 1) {
      const val = meetings[keys[i]];
      if (val.meetingType === 'instant') {
        result.push(val);
      }

      if (val.meetingType === 'group') {
        if (val.channelName.startsWith('G-')) {
          let conversationId = val.channelName.substr(2);
          conversationId = conversationId.replace(/-/g, '/');
          try {
            conversationId = window.atob(conversationId);
          } catch (e) {}

          if (!isConversationExist(conversationId)) {
            result.push(val);
          }
        } else {
          result.push(val);
        }
      }
    }

    result.sort((a: any, b: any) => {
      return b.timestamp - a.timestamp;
    });
    return result;
  };

  public getFilterNoAllConversations = (folderName?: string) => {
    const { conversations, ourNumber } = this.props;
    const { chatFolders, currentFolder } = this.state;

    let folder = {} as any;
    if (folderName) {
      folder = chatFolders?.find(f => f.name === folderName);
    } else {
      folder = chatFolders?.find(f => f.name === currentFolder);
    }
    const cids =
      folder?.cIds?.map((c: any) => {
        if (c?.id) {
          return (window as any).Signal.ID.convertIdToV1(c.id);
        }
      }) || [];
    let filterConversations = [];
    if (currentFolder === 'Private' && folder?.type === 0) {
      filterConversations =
        conversations?.filter(c => c.type !== 'group') || [];
    } else if (currentFolder === '@Me' && folder?.type === 0) {
      filterConversations =
        conversations?.filter(
          c =>
            c.unreadCount > 0 &&
            (c.atPersons?.includes(ourNumber) ||
              c.atPersons?.includes('MENTIONS_ALL'))
        ) || [];
    } else if (currentFolder === 'Unread' && folder?.type === 0) {
      filterConversations = conversations?.filter(c => c.unreadCount > 0) || [];
    } else {
      const groupOwners = folder?.conditions?.groupOwners || '';
      const groupOwnersIds = groupOwners.split(',') || [];
      const keywords = (folder?.conditions?.keywords || '').toLocaleLowerCase();
      filterConversations =
        conversations?.filter((c: any) => {
          const groupOwnerId = (window as any).ConversationController.get(
            c.id
          )?.getGroupOwnerId();
          const groupOwnersCondition = Boolean(
            groupOwnersIds.length > 0 &&
              groupOwnerId &&
              groupOwnersIds.includes(groupOwnerId)
          );
          return (
            cids?.includes(c.id) ||
            (keywords &&
              keywords.length > 0 &&
              c.name?.toLocaleLowerCase()?.includes(keywords)) ||
            groupOwnersCondition
          );
        }) || [];
    }

    return filterConversations;
  };

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const {
      archivedConversations,
      conversations,
      ourNumber,
      i18n,
      openConversationInternal,
      showArchived,
      meetings,
    } = this.props;

    const { chatFolders, currentFolder } = this.state;

    if (!conversations || !archivedConversations) {
      throw new Error(
        'renderRow: Tried to render without conversations or archivedConversations'
      );
    }

    if (!showArchived && currentFolder === 'all_conversation_unique') {
      const instantMeetings = this.getInstantMeetings();
      if (index < instantMeetings.length) {
        const mt = instantMeetings[index];
        return (
          <ConversationListInstantMeetingItem
            key={key}
            style={style}
            i18n={i18n}
            ourNumber={ourNumber}
            meetingStatus={mt}
          />
        );
      }
      index -= instantMeetings.length;
    }

    // if (!showArchived && index === conversations.length) {
    //   return this.renderArchivedButton({ key, style });
    // }

    const filterConversations =
      currentFolder !== 'all_conversation_unique'
        ? this.getFilterNoAllConversations()
        : [];

    const conversation = showArchived
      ? archivedConversations[index]
      : currentFolder === 'all_conversation_unique'
      ? conversations[index]
      : filterConversations[index];

    let meetingStatus = null;
    if (conversation.type === 'group' && meetings) {
      let channelName = window.btoa(conversation.id);
      const re = new RegExp('/', 'g');
      channelName = `G-${channelName.replace(re, '-')}`;
      if (meetings.hasOwnProperty(channelName)) {
        meetingStatus = meetings[channelName];
        if (meetingStatus.meetingType !== 'group') {
          meetingStatus = null;
        }
      }
    }

    if (conversation.type === 'direct' && meetings) {
      const keys = Object.keys(meetings);
      for (let i = 0; i < keys.length; i += 1) {
        const val = meetings[keys[i]];
        // 1v1
        if (
          val.meetingType === 'private' &&
          val.privateUsers &&
          Array.isArray(val.privateUsers) &&
          val.privateUsers.length === 2 &&
          val.privateUsers.includes(conversation.id.replace('+', '')) &&
          ourNumber !== conversation.id
        ) {
          meetingStatus = val;
          break;
        }
      }
    }

    return (
      <ConversationListItem
        key={key}
        style={style}
        {...conversation}
        ourNumber={ourNumber}
        onClick={(id: string, event?: ListItemClickEvent) => {
          console.log('LeftPan.tx click item.');
          // should open conversation except right clicking
          if (event?.button !== 2) {
            console.log('LeftPan.tx click openConversationInternal.');
            openConversationInternal(id);
          } else {
            (window as any).forceCloseWebview();

            console.log('LeftPan.tx click NOT openConversationInternal.');
            let folder = [];
            for (let i = 0; i < chatFolders.length; i++) {
              for (let j = 0; j < chatFolders[i].cIds.length; j++) {
                if (
                  id ===
                  (window as any).Signal.ID.convertIdToV1(
                    chatFolders[i].cIds[j].id
                  )
                ) {
                  folder.push(chatFolders[i]);
                }
              }
            }
            //console.log(conversation);
            this.setState({
              checkConversationInFolder: folder,
              currentCheckConversation: conversation,

              showChatOperationMenu: true,
            });
            this.showConversationOperationMenu(event);
            $('.module-left-pane__virtual-list').css('overflow', 'hidden');
          }
        }}
        onDoubleClick={() => {
          //@ts-ignore
          const { markAsRead } = conversation;
          if (markAsRead) {
            markAsRead();
          }
        }}
        i18n={i18n}
        meetingStatus={meetingStatus}
      />
    );
  };

  public showConversationOperationMenu = (event: ListItemClickEvent): void => {
    const x = event.pageX;
    let y = event.pageY;
    const windowHeight = window.innerHeight;
    const menuHeight = $('.conversation-operation-menu').innerHeight() || 0;
    if (menuHeight + y >= windowHeight) y = y - menuHeight;
    $('.conversation-operation-menu').css('left', x).css('top', y);
    // .css('display', 'block');
  };

  public renderArchivedButton({
    key,
    style,
  }: {
    key: string;
    style: Object;
  }): JSX.Element {
    const { archivedConversations, i18n, showArchivedConversations } =
      this.props;

    if (!archivedConversations || !archivedConversations.length) {
      throw new Error(
        'renderArchivedButton: Tried to render without archivedConversations'
      );
    }

    return (
      <ContactListItem
        key={key}
        style={style}
        phoneNumber={''}
        name={
          i18n('archivedConversations') +
          '(' +
          archivedConversations.length +
          ')'
        }
        color={'archive-yellow'}
        verified={false}
        avatarPath={''}
        i18n={i18n}
        onClick={showArchivedConversations}
        archiveButton={true}
      />
    );

    // return (
    //   <div
    //     key={key}
    //     className="module-left-pane__archived-button"
    //     style={style}
    //     role="button"
    //     onClick={showArchivedConversations}
    //   >
    //     {i18n('archivedConversations')}{' '}
    //     <span className="module-left-pane__archived-button__archived-count">
    //       {archivedConversations.length}
    //     </span>
    //   </div>
    // );
  }

  public onListScroll = () => {
    this.setState({ shownUnreadIndex: undefined });
  };

  public renderList(): JSX.Element | Array<JSX.Element | null> {
    const {
      archivedConversations,
      i18n,
      conversations,
      openConversationInternal,
      startNewConversation,
      searchResults,
      showArchived,
    } = this.props;

    // disable chatFolders
    // const { currentFolder } = this.state;
    const currentFolder = 'all_conversation_unique';

    if (searchResults) {
      return (
        <SearchResults
          {...searchResults}
          openConversation={openConversationInternal}
          startNewConversation={startNewConversation}
          i18n={i18n}
        />
      );
    }

    if (!conversations || !archivedConversations) {
      throw new Error(
        'render: must provided conversations and archivedConverstions if no search results are provided'
      );
    }

    const filterConversations =
      currentFolder !== 'all_conversation_unique'
        ? this.getFilterNoAllConversations()
        : [];

    // That extra 1 element added to the list is the 'archived converastions' button
    const length = showArchived
      ? archivedConversations.length
      : currentFolder === 'all_conversation_unique'
      ? conversations.length
      : // ? conversations.length + (archivedConversations.length ? 1 : 0)
        filterConversations.length;

    const archived = showArchived ? (
      <div className="module-left-pane__archive-helper-text" key={0}>
        {i18n('archiveHelperText')}
      </div>
    ) : null;

    // We ensure that the listKey differs between inbox and archive views, which ensures
    //   that AutoSizer properly detects the new size of its slot in the flexbox. The
    //   archive explainer text at the top of the archive view causes problems otherwise.
    //   It also ensures that we scroll to the top when switching views.
    const listKey = showArchived ? 1 : 0;

    let theClasses = 'module-left-pane__virtual-list';
    if (this.state.listStyle === 'hidden') {
      theClasses += ' overflow-style-hidden';
    } else {
      theClasses += ' overflow-style-normal';
    }

    let imCount = 0;
    if (!showArchived && currentFolder === 'all_conversation_unique') {
      imCount = this.getInstantMeetings().length;
    }

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.

    const list = (
      <div className="module-left-pane__list" key={listKey}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              id={'left-pane-list-id'}
              scrollToAlignment="start"
              className={theClasses}
              conversations={
                currentFolder === 'all_conversation_unique'
                  ? conversations
                  : filterConversations
              }
              height={height}
              rowCount={length + imCount}
              rowHeight={56}
              rowRenderer={this.renderRow}
              width={width}
              onScroll={this.onListScroll}
              scrollToIndex={this.state.shownUnreadIndex}
            />
          )}
        </AutoSizer>
      </div>
    );

    if (
      currentFolder !== 'all_conversation_unique' &&
      filterConversations.length === 0
    ) {
      return (
        <div className={'folder-no-conversaion-box'}>
          <div className={'logo'}>
            <img
              style={{ height: '70px', width: '70px' }}
              src="./images/LOGO.svg"
              alt={''}
            />
          </div>
          <div className={'tip'}>{i18n('no-conversation-tip')}</div>
        </div>
      );
    }
    if (
      currentFolder === 'all_conversation_unique' &&
      conversations.length === 0 &&
      archivedConversations.length === 0
    ) {
      return (
        <div className={'folder-no-conversaion-box'}>
          <div className={'logo'}>
            <img
              style={{ height: '70px', width: '70px' }}
              src="./images/LOGO.svg"
              alt={''}
            />
          </div>
          <div className={'tip'}>{i18n('all-no-conversation-tip')}</div>
        </div>
      );
    }
    return [archived, list];
  }

  public renderArchivedHeader(): JSX.Element {
    const { i18n, showInbox } = this.props;

    return (
      <div className="module-left-pane__archive-header">
        <div
          role="button"
          onClick={showInbox}
          className="module-left-pane__to-inbox-button"
        />
        <div className="module-left-pane__archive-header-text">
          {i18n('archivedConversations')}
        </div>
      </div>
    );
  }

  public renderChatFolders() {
    const { chatFolders, currentFolder, currentEditFolder } = this.state;
    const { conversations, i18n, ourNumber } = this.props;

    if (!chatFolders || chatFolders.length == 0) return null;

    let totalUnreadConversation = 0;
    let privateCount = 0;
    let unreadCount = 0;
    let atMeCount = 0;
    if (conversations && conversations.length > 0) {
      for (let i = 0; i < conversations.length; i++) {
        if (conversations[i].unreadCount > 0) {
          unreadCount += 1;
          totalUnreadConversation += 1;
        }
        if (
          conversations[i].type !== 'group' &&
          conversations[i].unreadCount > 0
        ) {
          privateCount += 1;
        }
        if (
          (conversations[i].atPersons?.includes(ourNumber) ||
            conversations[i].atPersons?.includes('MENTIONS_ALL')) &&
          conversations[i].unreadCount > 0
        ) {
          atMeCount += 1;
        }
      }
    }
    const style = {
      borderBottom: '3px solid rgb(70,167,237)',
      color: 'rgb(70,167,237)',
    };
    return (
      <div
        onScroll={() => {
          this.restoreStyle();
        }}
        className={'module-left-pane__chat-folder'}
        ref={this.folderBarRef}
      >
        <div
          id={'folder-all'}
          className={'chat-folder-item'}
          onClick={() => {
            if (currentFolder === 'all_conversation_unique') {
              return;
            }
            this.setState({
              currentFolder: 'all_conversation_unique',
              currentUnreadIndex: 0,
              shownUnreadIndex: 0,
            });
          }}
        >
          <div
            className={'name'}
            style={currentFolder === 'all_conversation_unique' ? style : {}}
          >
            {i18n('folder-all')}
            {totalUnreadConversation > 0 && (
              <span className={'count'}>
                {'(' + totalUnreadConversation + ')'}
              </span>
            )}
          </div>
        </div>
        {chatFolders.map((item: any) => {
          let unreadConversation = 0;
          const conversations =
            this.getFilterNoAllConversations(item.name) || [];
          if (conversations && conversations.length > 0) {
            conversations.forEach((c: any) => {
              if (c.unreadCount > 0) {
                unreadConversation += 1;
              }
            });
          }
          return (
            <div
              key={item.name}
              className={'chat-folder-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  if (currentFolder === item.name) return;
                  this.setState({
                    currentFolder: item.name,
                    currentEditFolder: item,
                    currentUnreadIndex: 0,
                    shownUnreadIndex: 0,
                  });
                  const element = document.getElementById(
                    item.name
                  ) as HTMLDivElement;
                  if (element) {
                    this.handleClickToScrollAdapt(element);
                  }
                }
                if (event && event.button === 2) {
                  if (!item.name || item.name.length === 0) {
                    return;
                  }
                  const x = event.pageX;
                  const y = event.pageY;
                  $('.folder-bar-operation-menu')
                    .css('left', x)
                    .css('top', y)
                    .css('display', 'block');
                  this.setState({ currentEditFolder: item });
                }
              }}
            >
              <div
                style={currentFolder === item.name ? style : {}}
                className={'name'}
                id={item.name}
              >
                {item.type === 0 ? i18n(item.name) : item.name}
                {item.type !== 0 && unreadConversation > 0 && (
                  <span className={'count'}>
                    {'(' + unreadConversation + ')'}
                  </span>
                )}
                {item.type === 0 && item.name === '@Me' && atMeCount > 0 && (
                  <span className={'count'}>{'(' + atMeCount + ')'}</span>
                )}
                {item.type === 0 &&
                  item.name === 'Private' &&
                  privateCount > 0 && (
                    <span className={'count'}>{'(' + privateCount + ')'}</span>
                  )}
                {item.type === 0 &&
                  item.name === 'Unread' &&
                  unreadCount > 0 && (
                    <span className={'count'}>{'(' + unreadCount + ')'}</span>
                  )}
              </div>
            </div>
          );
        })}
        <div
          className={'folder-bar-operation-menu'}
          onMouseDown={event => {
            if (event && event.button === 2) {
              $('.folder-bar-operation-menu').css('display', 'none');
            }
          }}
        >
          {currentEditFolder && currentEditFolder.type !== 0 && (
            <div
              className={'bar-menu-item'}
              onMouseDown={() => {
                this.showSignalView('showChatFolder');
                this.handleClickToEdiChatFolder(currentEditFolder.name);
              }}
            >
              {/*<div className={'bar-edit-icon'} />*/}
              <div className={'bar-operation'}>{i18n('edit-folder')}</div>
            </div>
          )}
          {currentEditFolder && currentEditFolder.type !== 0 && (
            <div
              className={'bar-menu-item'}
              onMouseDown={() => {
                this.handleClickToEdiChatFolder(currentEditFolder.name, 'true');
              }}
            >
              {/*<div className={'bar-add-icon'} />*/}
              <div className={'bar-operation'}>{i18n('add_chats')}</div>
            </div>
          )}
          <div
            className={'bar-menu-item-delete'}
            onMouseDown={async () => {
              const tip =
                currentEditFolder?.type === 0
                  ? i18n('delete-recommend-folder-confirm-tip')
                  : i18n('delete-folder-confirm-tip');

              if (isLinux()) {
                if (await (window as any).whisperConfirm(tip)) {
                  this.deleteFolder(currentEditFolder.name);
                }
              } else {
                if (confirm(tip)) {
                  this.deleteFolder(currentEditFolder.name);
                }
              }
            }}
          >
            {/*<div className={'bar-delete-icon'} />*/}
            <div className={'bar-operation-delete'}>
              {currentEditFolder?.type === 0
                ? i18n('remove-folder')
                : i18n('delete-folder')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  public handleFolderBarAddChats = async (event: any) => {
    const { showChatFolder } = this.state;
    const chatFolder = { ...event.detail };
    try {
      console.log(chatFolder);
      await (window as any).getAccountManager().setProfile({
        privateConfigs: {
          chatFolder,
        },
      });

      await (window as any).textsecure.storage.put('chatFolder', chatFolder);
      this.setState({
        chatFolders: chatFolder.value,
        version: chatFolder.version,
      });

      if (showChatFolder) {
        this.setState({ operationType: 'detail' });
      }

      (window as any).noticeSuccess(this.props.i18n('add_success'));
    } catch (e: any) {
      if (e.name === 'HTTPError' && e.code === 413) {
        alert('The frequency of operation is too fast!');
      } else {
        const localChatFolder = (window as any).textsecure.storage.get(
          'chatFolder'
        );
        this.setState({ chatFolders: localChatFolder.value });
        (window as any).noticeError(
          'Operation failed! Check you network is conected!'
        );
        return;
      }
    }
  };

  public handleChatFolderUpdateOrCreate = async (
    _chatFolders: any,
    operationType?: string,
    folderName?: string,
    isRecommended?: boolean
  ) => {
    const value = this.formatFolder(_chatFolders);
    const version = this.state.version + 1;
    const chatFolder = {
      value,
      version,
    };
    try {
      await (window as any).getAccountManager().setProfile({
        privateConfigs: {
          chatFolder,
        },
      });

      (window as any).textsecure.storage.put('chatFolder', chatFolder);
      this.setState({
        chatFolders: value,
        version,
      });

      if (operationType === 'delete') {
        this.setState({
          currentFolder: 'all_conversation_unique',
          operationType: 'detail',
        });
        const boxScroll = document.querySelector(
          '.module-left-pane__chat-folder'
        ) as HTMLDivElement;
        if (boxScroll) {
          boxScroll.scrollTo({ left: 0, behavior: 'smooth' });
        }
      } else {
        if (operationType === 'create') {
          const boxScroll = document.querySelector(
            '.module-left-pane__chat-folder'
          ) as HTMLDivElement;
          if (boxScroll) {
            if (isRecommended) {
              setTimeout(() => {
                boxScroll.scrollTo({ left: 0, behavior: 'smooth' });
              });
            } else {
              setTimeout(() => {
                boxScroll.scrollTo({ left: 100000, behavior: 'smooth' });
              });
            }
          }
        }
        if (folderName && folderName.length > 0) {
          const currentEditFolder = value?.find(
            (f: any) => f.name === folderName
          );
          this.setState({
            operationType: 'detail',
            currentFolder: folderName,
            currentEditFolder,
          });
          setTimeout(() => {
            const element = document.getElementById(
              folderName
            ) as HTMLDivElement;
            if (element) {
              this.handleClickToScrollAdapt(element);
            }
          });
        } else {
          setTimeout(() => {
            const element = document.getElementById(
              this.state.currentFolder
            ) as HTMLDivElement;
            if (element) {
              this.handleClickToScrollAdapt(element);
            }
          });
          this.setState({ operationType: 'detail' });
        }
      }

      (window as any).noticeSuccess(
        operationType === 'edit'
          ? 'Edit successfully!'
          : operationType === 'create'
          ? 'Create successfully!'
          : operationType === 'delete'
          ? 'Delete successfully!'
          : 'Operation successfully!'
      );
    } catch (e: any) {
      if (e.name === 'HTTPError' && e.code === 413) {
        alert('The frequency of operation is too fast!');
      } else if (e.name === 'TypeError') {
        (window as any).noticeError('Error data');
      } else {
        this.setState({
          currentFolder: 'all_conversation_unique',
          operationType: 'detail',
        });
        (window as any).noticeError(
          'Operation failed! Check you network is connected!'
        );
      }
    }
  };

  public removeConversationInFolder = async () => {
    const { chatFolders, currentCheckConversation, currentFolder } = this.state;
    const version = this.state.version + 1;
    const result = [...chatFolders];
    const folder = result?.find(f => f.name === currentFolder);
    if (!folder) {
      (window as any).noticeError('Remove failed');
      return;
    }
    const ids = folder.cIds?.filter(
      (e: any) => e.id !== currentCheckConversation.id
    ) as Array<string>;

    const kw = folder?.conditions?.keywords;
    const groupOwners = folder?.conditions?.groupOwners;
    if (
      ids.length === 0 &&
      (!kw || kw.length === 0) &&
      (!groupOwners || groupOwners.length === 0)
    ) {
      (window as any).noticeWarning(this.props.i18n('delete-conversation-tip'));
      return;
    }

    folder.cIds = ids;
    for (let i = 0; i < result.length; i++) {
      if (result[i].name === folder.name) {
        result.splice(i, 1, folder);
        break;
      }
    }
    try {
      await (window as any).getAccountManager().setProfile({
        privateConfigs: {
          chatFolder: {
            value: result,
            version,
          },
        },
      });

      (window as any).textsecure.storage.put('chatFolder', {
        value: result,
        version,
      });
      (window as any).noticeSuccess('Remove successfully');
      this.setState({
        chatFolders: result,
        version,
        operationType: 'detail',
      });
    } catch (e: any) {
      if (e.name === 'HTTPError' && e.code === 413) {
        alert('The frequency of operation is too fast!');
      } else {
        (window as any).noticeError(
          'Operation failed! Check you network is conected!'
        );
      }
    }
  };

  public editCurrentFolder = () => {
    if (this.state.currentFolder === 'all_conversation_unique') return;
    this.showSignalView('showChatFolder');
    this.handleClickToEdiChatFolder(this.state.currentFolder);
  };

  public handleMenuStick = () => {
    const { conversationStick } = this.props;
    const { currentCheckConversation } = this.state;
    if (conversationStick) {
      conversationStick(
        currentCheckConversation.id,
        !currentCheckConversation.isStick
      );
    }
  };
  public handleConversationMute = async () => {
    const { conversationMute } = this.props;
    const { currentCheckConversation } = this.state;
    if (conversationMute) {
      conversationMute(
        currentCheckConversation.id,
        !currentCheckConversation.isMute
      );
    }
  };

  public handleMenuDeleteMessage = (deleteInFolder?: any) => {
    const { deleteMessages } = this.props;
    const { currentCheckConversation } = this.state;
    if (deleteMessages) {
      const type =
        currentCheckConversation.type === 'direct'
          ? 'private'
          : currentCheckConversation.type;
      deleteMessages(currentCheckConversation.id, type, deleteInFolder);
    }
  };

  public handleClickToEdiChatFolder = async (
    folderName: string,
    isBarOperation?: string
  ) => {
    const chatFolders = this.state.chatFolders || [];

    let targetFolder = {} as any;
    for (let i = 0; i < chatFolders.length; i++) {
      if (chatFolders[i]?.name === folderName) {
        targetFolder = chatFolders[i];
        break;
      }
    }

    if (
      !targetFolder ||
      !targetFolder.name ||
      (!targetFolder?.cIds?.length &&
        !targetFolder?.conditions.keywords &&
        !targetFolder?.conditions?.groupOwners)
    ) {
      (window as any).noticeError('Operation failed! Unavailable Folder!');
      return;
    }

    const cIds = targetFolder.cIds || [];
    let selectedConversations = [] as any;
    try {
      for (let i = 0; i < cIds.length; i++) {
        const conversation = (window as any).ConversationController.get(
          (window as any).Signal.ID.convertIdToV1(cIds[i]?.id)
        );
        if (conversation) {
          selectedConversations.push(conversation.cachedProps);
        }
      }
      if (isBarOperation) {
        const contact = (window as any).getAliveConversationsProps();
        const ev = new CustomEvent('folder-add-conversation', {
          detail: [selectedConversations, contact, folderName, true],
        });
        window.dispatchEvent(ev);
      } else {
        setTimeout(() => {
          if (this?.chatFolderRef?.current) {
            this.setState({ operationType: 'edit' });
            this?.chatFolderRef?.current?.initEditFolderData(
              selectedConversations,
              targetFolder.name,
              targetFolder?.conditions
            );
          }
        }, 10);
      }
    } catch (e) {
      (window as any).noticeError('Operation failed! Unavailable Folder!');
      console.log(e);
      return;
    }
  };

  public handleFolderBarVisible = (event: any) => {
    // do not show  chat folder
    this.setState({ showChatFolderBar: event.detail && false });

    setTimeout(() => {
      const element = document.getElementById(
        this.state.currentFolder
      ) as HTMLDivElement;
      if (element) {
        this.handleClickToScrollAdapt(element);
      }
    }, 100);
  };

  public handleConversationOperate = (event: any) => {
    this.setState({ showChatOperationMenu: true });

    if (this.props.searchResults) {
      return;
    }
    const x = event.detail.event.pageX;
    let y = event.detail.event.pageY;
    const windowHeight = window.innerHeight;
    const menuHeight = $('.conversation-operation-menu').innerHeight() || 0;
    if (menuHeight + y >= windowHeight) {
      y = y - menuHeight;
    }
    $('.conversation-operation-menu').css('left', x).css('top', y);
    this.setState({ conversationRef: event.detail.refCurrent });
  };

  public handleClickToScrollAdapt(element: HTMLDivElement) {
    const box = document.querySelector(
      '.module-left-pane__chat-folder-wrap'
    ) as HTMLDivElement;
    const boxScroll = document.querySelector(
      '.module-left-pane__chat-folder'
    ) as HTMLDivElement;
    const oldScroll = element.scrollLeft;
    const difference =
      element.offsetLeft -
      box.offsetLeft +
      element.offsetWidth / 2 -
      box.offsetWidth / 2;
    boxScroll.scrollTo({ left: oldScroll + difference, behavior: 'smooth' });
  }

  public checkConversationToFolder = (folderName: string) => {
    const { currentCheckConversation, chatFolders } = this.state;
    let cid =
      currentCheckConversation.type === 'group'
        ? (window as any).Signal.ID.convertIdToV2(currentCheckConversation.id)
        : currentCheckConversation.id;

    const transferFolder =
      chatFolders?.find(f => f.name === folderName) || ({} as any);

    if (!transferFolder) {
      (window as any).noticeError('Transfer folder is not available!');
      return;
    }

    const cids = transferFolder?.cIds?.filter((c: any) => c.id !== cid);
    if (cids.length === transferFolder?.cIds?.length) {
      transferFolder?.cIds?.push({
        id: cid,
        type: currentCheckConversation.type === 'group' ? 1 : 0,
      });
    } else {
      const kw = transferFolder?.conditions?.keywords;
      const groupOwners = transferFolder?.conditions?.groupOwners;
      if (
        cids.length === 0 &&
        (!kw || kw.length === 0) &&
        (!groupOwners || groupOwners.length === 0)
      ) {
        (window as any).noticeWarning(
          this.props.i18n('delete-conversation-tip')
        );
        return;
      }
      transferFolder.cIds = cids;
    }
    const _chatFolders = chatFolders.map(f => {
      if (f.name === transferFolder.name) {
        return transferFolder;
      }
      return f;
    });
    this.handleChatFolderUpdateOrCreate(_chatFolders);
  };

  public adapteChatFolderListMenuSite = () => {
    $('.check-folder-operation-menu').css('display', 'block');
    const windowHeight = window.innerHeight;
    const folderList = document.querySelector(
      '.check-folder-operation-menu'
    ) as any;
    const menuList = document.querySelector(
      '.conversation-operation-menu'
    ) as any;
    const listHeight = folderList.offsetHeight;
    const folderListTop = folderList.offsetTop;
    const menuListTop = menuList.offsetTop;
    if (folderListTop + menuListTop + listHeight >= windowHeight) {
      $('.check-folder-operation-menu').css(
        'top',
        folderListTop - listHeight + 65
      );
    }
  };
  public restoryChatFolderListMenuSite = () => {
    $('.check-folder-operation-menu').css('display', 'none').css('top', 120);
  };
  public selectMenuMouseOver = () => {
    this.adapteChatFolderListMenuSite();
  };
  public selectMenuMouseLeave = () => {
    this.restoryChatFolderListMenuSite();
  };
  public selectFolderMouseOver = () => {
    this.adapteChatFolderListMenuSite();
  };
  public selectFolderMouseLeave = () => {
    this.restoryChatFolderListMenuSite();
  };

  public adapteNotificationListMenuSite = () => {
    const { chatFolders } = this.state;
    if (!chatFolders || chatFolders.length === 0) {
      $('.notification-operation-menu').css('top', 60);
    } else {
      $('.notification-operation-menu').css('top', 90);
    }
    $('.notification-operation-menu').css('display', 'block');
    const windowHeight = window.innerHeight;
    const notificationList = document.querySelector(
      '.notification-operation-menu'
    ) as any;
    const menuList = document.querySelector(
      '.conversation-operation-menu'
    ) as any;
    const listHeight = notificationList.offsetHeight;
    const notificationListTop = notificationList.offsetTop;
    const menuListTop = menuList.offsetTop;
    if (notificationListTop + menuListTop + listHeight >= windowHeight) {
      $('.notification-operation-menu').css(
        'top',
        notificationListTop - listHeight + 38
      );
    }
  };
  public restoryNotificationListMenuSite = () => {
    const { chatFolders } = this.state;
    if (!chatFolders || chatFolders.length === 0) {
      $('.notification-operation-menu').css('display', 'none').css('top', 12);
    } else {
      $('.notification-operation-menu').css('display', 'none').css('top', 90);
    }
  };
  public selectNotificationMenuMouseOver = () => {
    this.adapteNotificationListMenuSite();
  };
  public selectNotificationMenuMouseLeave = () => {
    this.restoryNotificationListMenuSite();
  };
  public selectNotificationMouseOver = () => {
    this.adapteNotificationListMenuSite();
  };
  public selectNotificationMouseLeave = () => {
    this.restoryNotificationListMenuSite();
  };

  public restoreStyle() {
    this.setState({ showChatOperationMenu: false });
    $('.folder-bar-operation-menu').css('display', 'none');
    $('.conversation-operation-menu').css('display', 'none');
    $('.module-conversation-list-item').css('outline', 'none');
    $('.module-left-pane__virtual-list').css('overflow', 'auto');
  }

  public chatFolderNoticeChange = (event: any) => {
    const { value, version } = event.detail || {};

    const names = value?.map((f: any) => f.name) || [];
    if (!names.includes(this.state.currentFolder)) {
      this.setState({
        currentFolder: 'all_conversation_unique',
      });
    }
    this.setState({
      chatFolders: value,
      version: version,
    });
  };

  public handleMouseDown = (event: MouseEvent) => {
    if (event) {
      if (event.button === 0) this.restoreStyle();
      if (
        event.button === 2 &&
        this.state.conversationRef &&
        !this.state.conversationRef.contains(event.target as Node)
      ) {
        this.setState({ showChatOperationMenu: false });
        // $('.conversation-operation-menu').css('display', 'none');
        $('.module-conversation-list-item').css('outline', 'none');
        $('.module-left-pane__virtual-list').css('overflow', 'auto');
      }
      if (
        event.button === 2 &&
        this.folderBarRef?.current &&
        !this.folderBarRef.current.contains(event.target as Node)
      ) {
        $('.folder-bar-operation-menu').css('display', 'none');
      }
    }
  };

  public handleClick = (event: MouseEvent) => {
    if (event) this.restoreStyle();
  };

  public deleteFolder = (folderName: any) => {
    if (!folderName || folderName.length === 0) {
      (window as any).noticeError('Folder is not available！');
      return;
    }
    const _chatFolders = this.state.chatFolders?.filter(f => f) || [];
    for (let i = 0; i < _chatFolders.length; i++) {
      if (_chatFolders[i].name === folderName) _chatFolders.splice(i, 1);
    }
    this.handleChatFolderUpdateOrCreate([..._chatFolders], 'delete');
  };

  public showSignalView = (operation: string) => {
    const status = { ...FULL_VIEW_STATUS_DICTIONARY } as any;

    for (let dictionaryKey in FULL_VIEW_STATUS_DICTIONARY) {
      if (operation === dictionaryKey) {
        status[operation] = true;
        break;
      }
    }
    this.setState(status);
    $('.conversation-stack').css('display', 'none');
  };

  public closeFullView = () => {
    this.setState(FULL_VIEW_STATUS_DICTIONARY);

    this.restoreStyle();

    $('.conversation-stack').css('display', 'block');
  };

  public operationFullView = (event: any) => {
    const { type, operation, params } = event?.detail || {};
    if (!type || type.length === 0) {
      return;
    }
    if (type === 'show') {
      if (operation === 'showChatFolder') {
        this.setState({ operationType: params });
      }
      if (operation === 'showWebview') {
        this.setState({
          webviewHttpUrl: params.httpUrl,
          webviewAppId: params.appId,
        });
      }

      this.showSignalView(operation);
    }

    if (type === 'close') {
      this.closeFullView();
    }
  };

  async componentDidMount() {
    window.addEventListener(
      'event-scroll-to-unread-message',
      this.scrollToUnreadMessage
    );
    window.addEventListener(
      'leftPaneRemoveConversationInfolder',
      this.removeConversationInFolder
    );
    window.addEventListener('edit-current-folder', this.editCurrentFolder);

    /// ***************** chat folder ************************
    const { value, version } =
      (window as any).textsecure.storage.get('chatFolder') || {};
    const localValue = this.formatFolder(value);

    try {
      const messaging = (window as any).textsecure.messaging;
      const storage = (window as any).textsecure.storage;
      if (!messaging) {
        this.setState({ chatFolders: localValue });
        (window as any).log.info(
          'load chat folders use local data',
          localValue
        );
      } else {
        const profile = await messaging.fetchDirectoryContacts([
          this.props.ourNumber,
        ]);
        const { privateConfigs } = profile?.contacts?.[0] || {};
        const { value, version } = privateConfigs?.chatFolder || {};
        const filterValue = this.formatFolder(value);
        storage.put('chatFolder', { version, value: filterValue });
        this.setState({ chatFolders: filterValue, version });
      }
    } catch (e) {
      this.setState({ chatFolders: localValue, version });
      (window as any).log.info('api load chat folder failed', e);
    }

    try {
      const globalConfig = (window as any).getGlobalConfig() || {};
      const maxFolderCount = globalConfig?.chatFolder?.maxFolderCount || 10;
      this.setState({ maxFolderCount });
    } catch (e) {
      (window as any).log.info('getGlobalConfig failed', e);
    }

    const contact = (window as any).getAliveConversationsProps() || [];
    this.setState({ contact });
    /// ***************** chat folder ************************

    window.addEventListener('operation-full-view', this.operationFullView);
    window.addEventListener(
      'chat-folder-notice-change',
      this.chatFolderNoticeChange
    );
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('click', this.handleClick);
    window.addEventListener(
      'folder-bar-add-chats',
      this.handleFolderBarAddChats
    );
    window.addEventListener('folder-bar-visible', this.handleFolderBarVisible);
    window.addEventListener(
      'conversation-operation',
      this.handleConversationOperate
    );
  }

  public formatFolder(folders: any) {
    return (
      folders?.map((f: any) => {
        const { cIds, type, folderType, name } = f || {};
        f.cIds = cIds?.filter((c: any) => c.id) || [];
        if (type === undefined) {
          f.type = folderType;
        }
        if (name === 'Unread' || name === '@Me' || name === 'Private') {
          f.type = 0;
        }
        return f;
      }) || []
    );
  }

  componentWillUnmount() {
    window.removeEventListener(
      'event-scroll-to-unread-message',
      this.scrollToUnreadMessage
    );
    window.removeEventListener('operation-full-view', this.operationFullView);
    window.removeEventListener(
      'chat-folder-notice-change',
      this.chatFolderNoticeChange
    );
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('click', this.handleClick);
    window.removeEventListener(
      'folder-bar-add-chats',
      this.handleFolderBarAddChats
    );
    window.removeEventListener(
      'folder-bar-visible',
      this.handleFolderBarVisible
    );
    window.removeEventListener(
      'conversation-operation',
      this.handleConversationOperate
    );
    window.removeEventListener(
      'leftPaneRemoveConversationInfolder',
      this.removeConversationInFolder
    );
    window.removeEventListener('edit-current-folder', this.editCurrentFolder);
  }

  public notificationTypeList() {
    const { currentCheckConversation } = this.state;
    const { i18n, ourNumber } = this.props;
    return (
      <div
        className={'notification-operation-menu'}
        onMouseOver={this.selectNotificationMouseOver}
        onMouseLeave={this.selectNotificationMouseLeave}
      >
        {NOTIFICATION_TYPE.map(m => {
          return (
            <div
              key={m.type}
              className={'notification-menu-item'}
              onMouseDown={async event => {
                if (
                  event &&
                  event.button === 0 &&
                  m.type !== currentCheckConversation.notificationSetting
                ) {
                  await (window as any).setGroupNotifyType(
                    m.type,
                    currentCheckConversation.id,
                    ourNumber
                  );
                } else {
                  console.log('check same notification type, skip......');
                }
              }}
            >
              {currentCheckConversation &&
              currentCheckConversation.notificationSetting === m.type ? (
                <div className={'check-icon'} />
              ) : null}
              <div className={'check-name'}>{i18n(m.i18nKey)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  public renderLeaveGroup() {
    const { i18n, conversationLeaveGroup } = this.props;
    const { currentCheckConversation } = this.state;
    const style = {
      color: '#f84135',
    };
    if (currentCheckConversation.type !== 'group') {
      return null;
    }
    if (currentCheckConversation.isGroupV2Owner) {
      return null;
    }
    if (!currentCheckConversation.isAliveGroup) {
      return null;
    }
    return (
      <div className={'conversation-menu-item'}>
        <div
          className={'conversation-operation'}
          style={style}
          onMouseDown={event => {
            if (event && event.button === 0) {
              conversationLeaveGroup(currentCheckConversation.id);
            }
          }}
        >
          {i18n('leaveGroup')}
        </div>
      </div>
    );
  }

  public renderDisbandGroup() {
    const { i18n, conversationDisbandGroup } = this.props;
    const { currentCheckConversation } = this.state;
    const style = {
      color: '#f84135',
    };

    if (currentCheckConversation.type !== 'group') {
      return null;
    }
    if (!currentCheckConversation.isGroupV2Owner) {
      return null;
    }
    if (!currentCheckConversation.isAliveGroup) {
      return null;
    }
    return (
      <div className={'conversation-menu-item'}>
        <div
          className={'conversation-operation'}
          style={style}
          onMouseDown={event => {
            if (event && event.button === 0) {
              conversationDisbandGroup(currentCheckConversation.id);
            }
          }}
        >
          {i18n('disbandGroup')}
        </div>
      </div>
    );
  }

  public renderFolderSelectList() {
    const { chatFolders, checkConversationInFolder } = this.state;
    let checkConversationInFolderNames = [] as any;
    if (checkConversationInFolder && checkConversationInFolder.length > 0) {
      checkConversationInFolderNames =
        checkConversationInFolder?.map((f: any) => {
          return f.name;
        }) || [];
    }

    if (!chatFolders || chatFolders.length === 0) {
      return null;
    }
    const folders = chatFolders?.filter(f => f.type !== 0) || [];
    return (
      <div
        className={'check-folder-operation-menu'}
        onMouseOver={this.selectFolderMouseOver}
        onMouseLeave={this.selectFolderMouseLeave}
      >
        {folders.map(folder => {
          return (
            <div
              className={'check-folder-menu-item'}
              key={folder.name}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.checkConversationToFolder(folder.name);
                }
              }}
            >
              {checkConversationInFolderNames &&
              checkConversationInFolderNames.length > 0 &&
              checkConversationInFolderNames.includes(folder.name) ? (
                <div className={'check-icon'} />
              ) : null}
              <div className={'check-name'}>{folder.name}</div>
            </div>
          );
        })}
      </div>
    );
  }

  public scrollToUnreadMessage = () => {
    const { archivedConversations, conversations, searchResults } = this.props;

    if (searchResults) {
      return;
    }

    const { currentFolder } = this.state;

    if (!conversations || !archivedConversations) {
      throw new Error(
        'render: must provided conversations and archivedConverstions if no search results are provided'
      );
    }
    const filterConversations =
      currentFolder !== 'all_conversation_unique'
        ? this.getFilterNoAllConversations()
        : [];

    let unreadArray = (
      currentFolder == 'all_conversation_unique'
        ? conversations
        : filterConversations
    )
      ?.map((conversation: any, index: number) => {
        if (conversation.unreadCount > 0 && !conversation.isMute) {
          return index;
        } else {
          return;
        }
      })
      .filter(i => i) as number[];

    if (unreadArray.length === 0) {
      const tempConversations =
        currentFolder == 'all_conversation_unique'
          ? conversations
          : filterConversations;
      if (
        tempConversations.length &&
        tempConversations[0].unreadCount > 0 &&
        !tempConversations[0].isMute
      ) {
        this.setState({ shownUnreadIndex: 0 });
        // @ts-ignore
        document.getElementById('left-pane-list-id')?.scrollTop = 0;
        return;
      }

      unreadArray = (
        currentFolder == 'all_conversation_unique'
          ? conversations
          : filterConversations
      )
        ?.map((conversation: any, index: number) => {
          if (conversation.unreadCount > 0 && conversation.isMute) {
            return index;
          } else {
            return;
          }
        })
        .filter(i => i) as number[];
    }

    const unreadMessagesIndices = [0].concat(unreadArray);
    if (unreadMessagesIndices.length <= 1) {
      this.setState({ shownUnreadIndex: 0 });
      // @ts-ignore
      document.getElementById('left-pane-list-id')?.scrollTop = 0;
      return;
    }

    // @ts-ignore
    const currentIndex = this.state.currentUnreadIndex;
    // @ts-ignore
    if (currentIndex >= unreadMessagesIndices?.length - 1) {
      this.setState({ shownUnreadIndex: unreadMessagesIndices[0] });
      this.setState({ currentUnreadIndex: 0 });
    } else {
      this.setState({
        shownUnreadIndex: unreadMessagesIndices[currentIndex + 1],
      });
      this.setState(prevState => ({
        // @ts-ignore
        currentUnreadIndex: prevState.currentUnreadIndex + 1,
      }));
    }
    console.log(
      unreadMessagesIndices,
      'shown index',
      // @ts-ignore
      this.state.shownUnreadIndex,
      'current index',
      // @ts-ignore
      this.state.currentUnreadIndex
    );
  };

  public renderMarkAsReadOrUnRead() {
    const { i18n } = this.props;
    const { currentCheckConversation } = this.state;

    if (!currentCheckConversation) {
      return;
    }

    let i18nKey;
    let handler: () => void;

    if (currentCheckConversation.unreadCount) {
      i18nKey = 'markAsRead';
      handler = currentCheckConversation.markAsRead;
    } else {
      i18nKey = 'markAsUnread';
      handler = currentCheckConversation.markAsUnread;
    }

    if (!handler) {
      return;
    }

    return (
      <div
        className={'conversation-menu-item'}
        onMouseDown={event => {
          if (event && event.button === 0) {
            handler();
          }
        }}
      >
        {/*<div className={'mute-icon'} />*/}
        <div className={'conversation-operation'}>{i18n(i18nKey)}</div>
      </div>
    );
  }

  public renderConversationOperationMenu() {
    const { i18n /* conversationArchived */ } = this.props;
    const {
      chatFolders,
      currentCheckConversation,
      currentEditFolder,
      currentFolder,
    } = this.state;

    if (!currentCheckConversation) {
      return null;
    }

    const folder = chatFolders?.filter(f => f.type !== 0) || [];

    return (
      <div className={'conversation-operation-menu'}>
        {!currentCheckConversation.isArchived ? (
          currentCheckConversation && currentCheckConversation.isStick ? (
            <div
              className={'conversation-menu-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.handleMenuStick();
                }
              }}
            >
              {/*<div className={'remove-stick-icon'} />*/}
              <div className={'conversation-operation'}>
                {i18n('removeFromTop')}
              </div>
            </div>
          ) : (
            <div
              className={'conversation-menu-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.handleMenuStick();
                }
              }}
            >
              {/*<div className={'stick-to-top-icon'} />*/}
              <div className={'conversation-operation'}>
                {i18n('stickToTop')}
              </div>
            </div>
          )
        ) : null}
        {!currentCheckConversation.isArchived ? (
          currentCheckConversation && currentCheckConversation.isMute ? (
            <div
              className={'conversation-menu-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.handleConversationMute();
                }
              }}
            >
              {/*<div c lassName={'unmute-icon'} />*/}
              <div className={'conversation-operation'}>{i18n('unmute')}</div>
            </div>
          ) : (
            <div
              className={'conversation-menu-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.handleConversationMute();
                }
              }}
            >
              {/*<div className={'mute-icon'} />*/}
              <div className={'conversation-operation'}>{i18n('mute')}</div>
            </div>
          )
        ) : null}
        {!currentCheckConversation.isArchived
          ? this.renderMarkAsReadOrUnRead()
          : null}
        {/* {currentCheckConversation && !currentCheckConversation.isArchived ? (
          <div
            className={'conversation-menu-item'}
            onMouseDown={event => {
              if (event && event.button === 0) {
                conversationArchived(currentCheckConversation.id);
                // this.handleConversationArchived()
              }
            }}
          >
            <div className={'conversation-operation'}>
              {i18n('archiveConversation')}
            </div>
          </div>
        ) : null} */}
        {folder &&
        folder.length > 0 &&
        currentCheckConversation &&
        !currentCheckConversation.isArchived ? (
          <div
            className={'conversation-menu-item'}
            onMouseOver={this.selectMenuMouseOver}
            onMouseLeave={this.selectMenuMouseLeave}
          >
            {/*<div className={'add-to-folder-icon'} />*/}
            <div className={'conversation-operation'}>
              {i18n('transferChatFolder')}
            </div>
            <div className={'conversation-to-folder-icon'} />
          </div>
        ) : null}
        {currentCheckConversation &&
        currentCheckConversation.type === 'group' &&
        !currentCheckConversation.isArchived ? (
          <div
            className={'conversation-menu-item'}
            onMouseOver={this.selectNotificationMenuMouseOver}
            onMouseLeave={this.selectNotificationMenuMouseLeave}
          >
            {/*<div className={'notification-icon'} />*/}
            <div className={'conversation-operation'}>
              {i18n('notifications')}
            </div>
            <div className={'conversation-to-folder-icon'} />
          </div>
        ) : null}
        {(currentFolder === 'all_conversation_unique' ||
          (currentEditFolder && currentEditFolder.type !== 0)) && (
          <div
            className={'conversation-menu-item-delete'}
            style={{
              borderTop: currentCheckConversation.isArchived ? '0px solid' : '',
            }}
            onMouseDown={event => {
              if (event && event.button === 0) {
                let type = undefined;
                if (currentFolder !== 'all_conversation_unique') {
                  const folder =
                    chatFolders?.find(f => f.name === currentFolder) ||
                    ({} as any);
                  const cids =
                    folder?.cIds?.map((c: any) =>
                      (window as any).Signal.ID.convertIdToV1(c.id)
                    ) || [];
                  if (cids?.includes(currentCheckConversation.id)) {
                    type = 1;
                  } else {
                    type = 2;
                  }
                }
                this.handleMenuDeleteMessage(type);
              }
            }}
          >
            {/*<div className={'conversation-delete-icon'} />*/}
            <div className={'conversation-operation-delete'}>
              {currentFolder === 'all_conversation_unique'
                ? i18n('delete-folder')
                : i18n('remove-folder')}
            </div>
          </div>
        )}
        {this.renderDisbandGroup()}
        {this.renderLeaveGroup()}
        {this.renderFolderSelectList()}
        {this.notificationTypeList()}
      </div>
    );
  }

  public render(): JSX.Element {
    const { renderMainHeader, showArchived, i18n, conversations, ourNumber } =
      this.props;
    const {
      showChatFolder,
      operationType,
      chatFolders,
      contact,
      maxFolderCount,
      showChatFolderBar,
      showWebview,
      webviewHttpUrl,
      webviewAppId,
      showChatOperationMenu,
    } = this.state;

    return (
      <div className="module-left-pane">
        <div className="module-left-pane__header">
          {showArchived ? this.renderArchivedHeader() : renderMainHeader()}
        </div>
        <div className={'module-left-pane__chat-folder-wrap'}>
          {chatFolders &&
            chatFolders.length > 0 &&
            !showArchived &&
            showChatFolderBar &&
            this.renderChatFolders()}
        </div>
        {this.renderList()}
        {showChatOperationMenu && this.renderConversationOperationMenu()}
        {showChatFolder && (
          <ChatFolders
            ourNumber={ourNumber}
            activeConversations={conversations}
            maxFolderCount={maxFolderCount}
            contact={contact}
            onRef={this.chatFolderRef}
            operationType={operationType}
            chatFolders={chatFolders ? chatFolders : []}
            i18n={i18n}
            onClose={this.closeFullView}
            updateOrCreate={(
              chatFolders,
              operationType: string,
              folderName?: string,
              isRecommended?: boolean
            ) => {
              this.handleChatFolderUpdateOrCreate(
                chatFolders,
                operationType,
                folderName,
                isRecommended
              );
            }}
            changeOperationType={(operationType: string) => {
              this.setState({ operationType });
            }}
            handleClickToEdit={(folderName: string) => {
              this.handleClickToEdiChatFolder(folderName);
            }}
          />
        )}
        {showWebview && webviewHttpUrl && webviewAppId.length > 0 && (
          <FullWebViewDialog
            webviewHttpUrl={webviewHttpUrl}
            webviewAppId={webviewAppId}
            onClose={this.closeFullView}
            i18n={i18n}
          />
        )}
      </div>
    );
  }
}
