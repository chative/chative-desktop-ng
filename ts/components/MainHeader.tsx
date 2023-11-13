import React, { createRef } from 'react';
import { debounce } from 'lodash';
// import { Avatar } from './Avatar';

// import {cleanSearchTerm} from '../util/cleanSearchTerm';
import { LocalizerType } from '../types/Util';

export interface Props {
  searchTerm: string;

  // To be used as an ID
  ourNumber: string;
  regionCode: string;

  // For display
  phoneNumber: string;
  isMe: boolean;
  name?: string;
  color: string;
  verified: boolean;
  profileName?: string;
  avatarPath?: string;

  i18n: LocalizerType;
  updateSearchTerm: (searchTerm: string) => void;
  search: (
    query: string,
    options: {
      regionCode: string;
      ourNumber: string;
      noteToSelf: string;
    }
  ) => void;
  clearSearch: () => void;
}

type State = {
  miniProgramList: any;
  goForwardEnabled: boolean;
  goBackEnabled: boolean;
  showMenu: boolean;
};

const EmptyMagicString = '{3F29C7A4-E6C8-0FFF-3D56-6283CFD58EB6}';
export class MainHeader extends React.Component<Props, State> {
  public menuRef: React.RefObject<HTMLDivElement>;

  private readonly doUpdateSearchBound: (
    event: React.FormEvent<HTMLInputElement>
  ) => void;
  private readonly doClearSearchBound: () => void;
  private readonly handleKeyUpBound: (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => void;
  private readonly setFocusBound: () => void;
  private readonly getFocusBound: () => void;
  private readonly inputRef: React.RefObject<HTMLInputElement>;
  private readonly debouncedSearch: (searchTerm: string) => void;
  private readonly clearSearchNextTickBound: () => void;

  constructor(props: Props) {
    super(props);
    this.menuRef = createRef();
    this.clearSearchNextTickBound = this.clearSearchNextTick.bind(this);
    this.doUpdateSearchBound = this.doUpdateSearch.bind(this);
    this.doClearSearchBound = this.doClearSearch.bind(this);
    this.handleKeyUpBound = this.handleKeyUp.bind(this);
    this.setFocusBound = this.setFocus.bind(this);
    this.getFocusBound = this.getFocus.bind(this);
    this.hasApprovalService = this.hasApprovalService.bind(this);
    this.showApproval = this.showApproval.bind(this);
    this.inputRef = React.createRef();
    this.debouncedSearch = debounce(this.search.bind(this), 20);
    this.state = {
      miniProgramList: [],
      goForwardEnabled: false,
      goBackEnabled: false,
      showMenu: false,
    };
  }

  public search() {
    const { searchTerm, search, i18n, ourNumber, regionCode } = this.props;
    if (search) {
      search(searchTerm, {
        noteToSelf: i18n('noteToSelf'),
        ourNumber,
        regionCode,
      });
    }
  }

  public doUpdateSearch(event: React.FormEvent<HTMLInputElement>) {
    const { updateSearchTerm } = this.props;
    const searchTerm = event.currentTarget.value;
    if (!searchTerm) {
      this.doClearSearch();
      return;
    }

    if (updateSearchTerm) {
      updateSearchTerm(searchTerm);
    }

    if (searchTerm.length < 1) {
      return;
    }

    // const cleanedTerm = cleanSearchTerm(searchTerm);
    // if (!cleanedTerm) {
    //   return;
    // }

    this.debouncedSearch(searchTerm);
  }

  public doClearSearch() {
    const { clearSearch } = this.props;

    clearSearch();
  }

  public handleKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      this.doClearSearch();
    }
  }

  public clearSearchNextTick() {
    const { searchTerm } = this.props;
    if (searchTerm !== '' && searchTerm !== EmptyMagicString) {
      return;
    }

    setTimeout(() => {
      this.doClearSearch();
    }, 10);
  }

  public setFocus() {
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.focus();
    }
  }

  public getFocus() {
    window.dispatchEvent(
      new CustomEvent('folder-bar-visible', { detail: false })
    );

    const { searchTerm } = this.props;
    if (searchTerm !== '' && searchTerm !== EmptyMagicString) {
      return;
    }

    const { updateSearchTerm } = this.props;

    if (updateSearchTerm) {
      updateSearchTerm(EmptyMagicString);
    }
    this.debouncedSearch(EmptyMagicString);
  }

  public newGroup() {
    (window as any).showNewGroupWindow();
  }

  public newInstantMeeting() {
    (window as any).showInstantMeeting();
  }

  public showChatFolder() {
    const ev = new CustomEvent('operation-full-view', {
      detail: {
        type: 'show',
        operation: 'showChatFolder',
        params: 'detail',
      },
    });
    window.dispatchEvent(ev);
  }

  public hasApprovalService() {
    const APPROVAL_APP_ID = (window as any).getApprovalAppId();

    let miniProgramList = [] as any;
    if ((window as any).getMiniProgramList) {
      miniProgramList = (window as any)?.getMiniProgramList();
    }
    if (!miniProgramList || miniProgramList.length === 0) {
      return false;
    }
    let httpUrl = '';
    for (let i = 0; i < miniProgramList.length; i += 1) {
      if (miniProgramList[i].appId === APPROVAL_APP_ID) {
        httpUrl = miniProgramList[i].h5url;
        break;
      }
    }
    if (!httpUrl || httpUrl.length === 0) {
      return false;
    }
    return httpUrl;
  }

  public showApproval() {
    const APPROVAL_APP_ID = (window as any).getApprovalAppId();

    let miniProgramList = [] as any;
    if ((window as any).getMiniProgramList) {
      miniProgramList = (window as any)?.getMiniProgramList();
    }
    if (!miniProgramList || miniProgramList.length === 0) {
      return;
    }
    let app;
    for (let i = 0; i < miniProgramList.length; i += 1) {
      if (miniProgramList[i].appId === APPROVAL_APP_ID) {
        app = miniProgramList[i];
        break;
      }
    }
    if (!app) {
      return;
    }
    (window as any).openMiniProgramView(app, 'fullview');
  }

  public showMenu = (event: MouseEvent) => {
    let miniProgramList = [] as any;
    if ((window as any).getMiniProgramList) {
      miniProgramList = (window as any)?.getMiniProgramList();
    }
    if (miniProgramList) {
      this.setState({ miniProgramList });
    } else {
      if ((window as any).fetchMiniProgramList) {
        (window as any).fetchMiniProgramList();
      }
    }
    if (event && event.button === 0) {
      (window as any).forceCloseWebview();
      const { showMenu } = this.state;
      if (showMenu) {
        $('.main-header-operation-menu').css('display', 'none');
        this.setState({
          showMenu: false,
        });
        return;
      }
      const x = event.pageX;
      const y = event.pageY;
      $('.main-header-operation-menu')
        .css('display', 'block')
        .css('top', y)
        .css('left', x);
      this.setState({
        showMenu: true,
      });
    }
  };

  public renderMenu() {
    const { i18n } = this.props;
    // const { miniProgramList } = this.state;
    // const hasApprovalService = this.hasApprovalService();
    return (
      <div className={'main-header-operation-menu'}>
        <div className={'menu-item'} onMouseDown={this.newGroup}>
          <div className={'operation'}>{i18n('main_header_create_group')}</div>
        </div>
        {/* <div className={'menu-item'} onMouseDown={this.newInstantMeeting}>
          <div className={'operation'}>
            {i18n('main_header_instant_meeting')}
          </div>
        </div> */}
        {/* <div className={'menu-item'} onMouseDown={this.showChatFolder}>
          <div className={'operation'}>{i18n('chat_folders')}</div>
        </div> */}
        {/* {miniProgramList && miniProgramList.length > 0 && hasApprovalService ? (
          <div className={'menu-item'} onMouseDown={this.showApproval}>
            <div className={'operation'}>{i18n('create_approval')}</div>
          </div>
        ) : null} */}
      </div>
    );
  }

  public handleMouseDown = (event: MouseEvent) => {
    if (event) {
      if (
        event.button === 0 &&
        this.menuRef?.current &&
        !this.menuRef?.current.contains(event.target as Node)
      ) {
        $('.main-header-operation-menu').css('display', 'none');
        this.setState({
          showMenu: false,
        });
      }
      if (event.button === 2) {
        $('.main-header-operation-menu').css('display', 'none');
        this.setState({
          showMenu: false,
        });
      }
    }
  };
  public handleClick = (event: MouseEvent) => {
    if (event) {
      if (
        event.button === 0 &&
        this.menuRef?.current &&
        !this.menuRef?.current.contains(event.target as Node)
      ) {
        $('.main-header-operation-menu').css('display', 'none');
      }
    }
  };

  public handleOpenConversation = () => {
    $('.main-header-operation-menu').css('display', 'none');
  };

  public handleConversationSwitchEnabled = (event: any) => {
    const { goBackEnabled, goForwardEnabled } = event?.detail || {};
    this.setState({
      goBackEnabled,
      goForwardEnabled,
    });
  };

  componentDidMount() {
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('click', this.handleClick);
    window.addEventListener('open-conversation', this.handleOpenConversation);
    window.addEventListener(
      'conversation-switch-enabled',
      this.handleConversationSwitchEnabled
    );
    const { goBackEnabled, goForwardEnabled } =
      (window as any).getConversationSwitchStatus() || {};
    this.setState({
      goBackEnabled,
      goForwardEnabled,
    });
  }
  componentWillUnmount() {
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('click', this.handleClick);
    window.removeEventListener(
      'open-conversation',
      this.handleOpenConversation
    );
    window.removeEventListener(
      'conversation-switch-enabled',
      this.handleConversationSwitchEnabled
    );
  }

  public render() {
    const {
      searchTerm,
      // avatarPath,
      i18n,
      // ourNumber,
      // color,
      // name,
      // phoneNumber,
      // profileName,
    } = this.props;
    const { goBackEnabled, goForwardEnabled } = this.state;
    return (
      <div className="module-main-header">
        {/*<Avatar*/}
        {/*  avatarPath={avatarPath}*/}
        {/*  color={color}*/}
        {/*  conversationType="direct"*/}
        {/*  i18n={i18n}*/}
        {/*  name={name}*/}
        {/*  phoneNumber={phoneNumber}*/}
        {/*  profileName={profileName}*/}
        {/*  size={28}*/}
        {/*/>*/}
        <div className="module-main-header__search">
          <div
            role="button"
            className="module-main-header__search__icon"
            onClick={this.setFocusBound}
          />
          <input
            type="text"
            ref={this.inputRef}
            className="module-main-header__search__input"
            placeholder={i18n('search')}
            dir="auto"
            onKeyUp={this.handleKeyUpBound}
            value={searchTerm === EmptyMagicString ? '' : searchTerm}
            onChange={this.doUpdateSearchBound}
            onBlur={this.clearSearchNextTickBound}
            onFocus={this.getFocusBound}
          />
          {searchTerm && searchTerm !== EmptyMagicString ? (
            <div
              role="button"
              className="module-main-header__search__cancel-icon"
              onClick={this.doClearSearchBound}
            />
          ) : null}
        </div>
        <div
          className={
            goBackEnabled ? 'conversation-back' : 'conversation-back-disable'
          }
          onClick={() => {
            (window as any).conversationGoBack();
          }}
        />
        <div
          className={
            goForwardEnabled
              ? 'conversation-forward'
              : 'conversation-forward-disable'
          }
          onClick={() => {
            (window as any).conversationGoForward();
          }}
        />
        <div
          style={{ position: 'absolute', left: '340px' }}
          ref={this.menuRef}
          //@ts-ignore
          onClick={this.showMenu}
        >
          <div className="module-main-header__entry__plus-icon" />
        </div>
        {this.renderMenu()}
      </div>
    );
  }
}
