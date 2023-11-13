import React from 'react';
import { LocalizerType } from '../types/Util';
import { Button, Spin } from 'antd';
import classNames from 'classnames';
import { AppDetailDialog } from './conversation/AppDetailDialog';

type PropsType = {
  i18n: LocalizerType;
  ourNumber: string;
};

type StateType = {
  loadingState: number; // 0-loading, 1-loading failed, 2-loading success
  miniProgramList: Array<any>;
  currentAppItem: any;
  showAppItemMenu: boolean;
  appRef: any;
  left: number;
  top: number;
  searchText: string;
  showAppDetailDialog: boolean;
  pinAppsArr: Array<any>;
  miniProgramListBackUp: Array<any>;
  pinFlag: boolean;
};

export class WorkSpace extends React.Component<PropsType, StateType> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;
  constructor(props: any) {
    super(props);
    this.inputRef = React.createRef();

    let loadingState = 0;
    let miniProgramList = [];
    let miniProgramListBackUp = [];
    if ((window as any).getMiniProgramList) {
      loadingState = 2;
      miniProgramList = (window as any).getMiniProgramList() || [];
      const result = [];
      for (let i = 0; i < miniProgramList.length; i += 1) {
        if (miniProgramList[i]?.type === -1) {
          continue;
        }

        const supportOS = miniProgramList[i]?.supportOS;
        if (supportOS && !(supportOS & 1)) {
          continue;
        }

        // if (miniProgramList[i].appId === (window as any).getApprovalAppId()) {
        //   continue;
        // }
        result.push(miniProgramList[i]);
      }

      result.sort((a1, a2) =>
        a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
      );
      const pinAppsArr = JSON.parse(localStorage.getItem('pinAppsArr') || '[]');
      pinAppsArr.sort((a1: { name: string }, a2: { name: string }) =>
        a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
      );
      const mergeArr = pinAppsArr.concat(result);
      let obj = {};
      let deduplicationArr = mergeArr.reduce(
        (cur: any[], next: { appId: string | number }) => {
          // @ts-ignore
          obj[next.appId] ? '' : (obj[next.appId] = true && cur.push(next));
          return cur;
        },
        []
      );
      let unpinArr = deduplicationArr.slice(
        pinAppsArr.length,
        deduplicationArr.length + 1
      );
      const arrLast = this.sortByVpn(unpinArr);
      deduplicationArr = pinAppsArr.concat(arrLast);

      miniProgramList = deduplicationArr;
      miniProgramListBackUp = deduplicationArr;
    }

    this.state = {
      loadingState,
      miniProgramList,
      currentAppItem: undefined,
      showAppItemMenu: false,
      appRef: undefined,
      left: 0,
      top: 0,
      searchText: '',
      showAppDetailDialog: false,
      pinAppsArr: [],
      miniProgramListBackUp,
      pinFlag: false,
    };
  }

  public componentDidMount() {
    window.addEventListener(
      'got-mini-program-list',
      this.updateMiniProgramList
    );
    window.addEventListener('mousedown', this.handleMouseDown);
    this.setState({
      pinAppsArr: JSON.parse(localStorage.getItem('pinAppsArr') || '[]'),
    });
  }

  public componentWillUnmount() {
    window.removeEventListener(
      'got-mini-program-list',
      this.updateMiniProgramList
    );
    window.removeEventListener('mousedown', this.handleMouseDown);
  }

  public restoreStyle() {
    this.setState({ showAppItemMenu: false });
    $('.conversation-operation-menu').css('display', 'none');
  }

  public handleMouseDown = (event: MouseEvent) => {
    if (event) {
      if (event.button === 0) this.restoreStyle();
      // if (
      //   event.button === 2
      //   // &&
      //   // this.state.conversationRef &&
      //   // !this.state.conversationRef.contains(event.target as Node)
      // ) {
      //   this.setState({ showAppItemMenu: false });
      //   // $('.conversation-operation-menu').css('display', 'none');
      //   $('.module-conversation-list-item').css('outline', 'none');
      // }
    }
  };

  public showAppItemMenu = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ): void => {
    let x = event.pageX;
    let y = event.pageY;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const menuHeight = $('.conversation-operation-menu').innerHeight() || 0;
    if (menuHeight + y >= windowHeight) y = y - menuHeight;
    if (x + 180 >= windowWidth) x = x - 150;
    this.setState({
      left: x,
      top: y,
    });
    // $('.conversation-operation-menu').css('left', x).css('top', y);
  };

  public renderAppDetailDialog() {
    const { i18n } = this.props;
    const { currentAppItem, showAppDetailDialog, pinFlag } = this.state;
    if (!showAppDetailDialog) {
      return;
    }
    return (
      <>
        <AppDetailDialog
          i18n={i18n}
          onClose={() => {
            this.setState({
              showAppDetailDialog: false,
            });
          }}
          appDetail={currentAppItem}
          isPin={pinFlag}
          pinOrUnpin={(isPin, currentAppItem) => {
            this.setState({
              showAppDetailDialog: false,
            });
            this.pinOrUnpin(isPin, currentAppItem);
          }}
          openApp={() => {
            this.setState({
              showAppDetailDialog: false,
            });
            const type = currentAppItem.type;
            if (type === 1) {
              (window as any).sendBrowserOpenUrl(currentAppItem.h5url);
              return;
            }
            (window as any).openMiniProgramView(currentAppItem, type);
          }}
          showAppDetailDialog={showAppDetailDialog}
        ></AppDetailDialog>
      </>
    );
  }

  private sortByVpn = (unpinApps: any) => {
    const vpnArr = [];
    const unVpnArr = [];
    let mergeArr = [];
    for (let i = 0; i < unpinApps.length; i++) {
      if (unpinApps[i].labels.includes('VPN')) {
        vpnArr.push(unpinApps[i]);
      } else {
        unVpnArr.push(unpinApps[i]);
      }
    }
    vpnArr.sort((a1: { name: string }, a2: { name: string }) =>
      a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
    );
    unVpnArr.sort((a1: { name: string }, a2: { name: string }) =>
      a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
    );
    mergeArr = unVpnArr.concat(vpnArr);
    return mergeArr;
  };

  private sortAgainByPin = (programList?: any, search?: string) => {
    const { pinAppsArr, miniProgramList, searchText } = this.state;

    pinAppsArr.sort((a1: { name: string }, a2: { name: string }) =>
      a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
    );

    let newProgramList;
    if (programList && programList.length > 0) {
      newProgramList = programList.sort(
        (a1: { name: string }, a2: { name: string }) =>
          a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
      );
    } else if (programList && programList.length === 0) {
      this.setState({
        miniProgramList: programList,
      });
      return;
    } else {
      newProgramList = miniProgramList.sort((a1, a2) =>
        a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
      );
    }
    let mergeArr;
    let obj = {};
    let deduplicationArr;
    let arr = [];
    let unpinArr = [];

    if (searchText.length > 0 || search?.length) {
      for (let i = 0; i < pinAppsArr.length; i++) {
        if (
          newProgramList.find(
            (item: { appId: any }) => item.appId === pinAppsArr[i].appId
          )
        ) {
          arr.push(
            newProgramList.find(
              (item: { appId: any }) => item.appId === pinAppsArr[i].appId
            )
          );
        }
      }
      mergeArr = arr.concat(newProgramList);
    } else {
      arr = pinAppsArr;
      mergeArr = arr.concat(newProgramList);
    }

    deduplicationArr = mergeArr.reduce(
      (cur: any[], next: { appId: string | number }) => {
        // @ts-ignore
        obj[next.appId] ? '' : (obj[next.appId] = true && cur.push(next));
        return cur;
      },
      []
    );
    unpinArr = deduplicationArr.slice(arr.length, deduplicationArr.length + 1);
    const arrLast = this.sortByVpn(unpinArr);
    deduplicationArr = arr.concat(arrLast);

    this.setState({
      miniProgramList: Array.from(deduplicationArr),
    });
  };
  private pinOrUnpin = (isPin: boolean, currentAppItem: any) => {
    const { pinAppsArr } = this.state;
    if (isPin) {
      let index = pinAppsArr.findIndex(
        (item: { appId: any }) => item.appId === currentAppItem.appId
      );
      pinAppsArr.splice(index, 1);
    } else {
      pinAppsArr.push(currentAppItem);
    }
    this.setState({
      pinAppsArr,
    });
    this.sortAgainByPin();
    localStorage.setItem('pinAppsArr', JSON.stringify(pinAppsArr));
  };

  public renderAppItemMenu() {
    const { currentAppItem, left, top } = this.state;
    let isPin = false;
    if (!currentAppItem) {
      return null;
    }
    if (localStorage.getItem('pinAppsArr')) {
      if (
        JSON.parse(localStorage.getItem('pinAppsArr') || '[]').find(
          (item: { appId: any }) => {
            return item.appId === currentAppItem.appId;
          }
        )
      ) {
        isPin = true;
      }
    }
    return (
      <div
        className={'conversation-operation-menu'}
        style={{ left: left, top: top }}
      >
        <div
          className={'conversation-menu-item'}
          onMouseDown={event => {
            if (event && event.button === 0) {
              this.setState({
                showAppDetailDialog: true,
              });
            }
          }}
        >
          <div className={'conversation-operation'}>View App Details</div>
        </div>
        <div
          className={'conversation-menu-item'}
          onMouseDown={event => {
            if (event && event.button === 0) {
              if (isPin) {
                this.setState({
                  pinFlag: true,
                });
              } else {
                this.setState({
                  pinFlag: false,
                });
              }
              this.pinOrUnpin(isPin, currentAppItem);
            }
          }}
        >
          {isPin ? (
            <div className={'conversation-operation'}>Unpin App</div>
          ) : (
            <div className={'conversation-operation'}>Pin App</div>
          )}
        </div>
        {currentAppItem.guideUrl && (
          <div
            className={'conversation-menu-item'}
            onMouseDown={async event => {
              if (event && event.button === 0) {
                (window as any).sendBrowserOpenUrl(currentAppItem.guideUrl);
              }
            }}
          >
            <div className={'conversation-operation'}>App Guide</div>
          </div>
        )}
        {currentAppItem.supportBot && (
          <div
            className={'conversation-menu-item'}
            onMouseDown={event => {
              if (event && event.button === 0) {
                (window as any).jumpMessage({
                  conversationId: currentAppItem.supportBot,
                });
              }
            }}
          >
            <div className={'conversation-operation'}>Contact App Support</div>
          </div>
        )}
      </div>
    );
  }

  private updatePinAppInfo = (pinAppsArr: any, miniProgramList: any) => {
    if (pinAppsArr.length === 0) {
      return [];
    }
    const updatePinAppsArr = [];
    for (let i = 0; i < pinAppsArr.length; i++) {
      if (
        miniProgramList.find(
          (item: { appId: any }) => item.appId === pinAppsArr[i].appId
        )
      ) {
        updatePinAppsArr.push(
          miniProgramList.find(
            (item: { appId: any }) => item.appId === pinAppsArr[i].appId
          )
        );
      }
    }
    return updatePinAppsArr;
  };

  private updateMiniProgramList = (ev: any) => {
    if (!ev || !ev.detail) {
      this.setState({ loadingState: 1 });
      return;
    }

    const result = [];
    for (let i = 0; i < ev.detail.length; i += 1) {
      if (ev.detail[i]?.type === -1) {
        continue;
      }

      const supportOS = ev.detail[i]?.supportOS;
      if (supportOS && !(supportOS & 1)) {
        continue;
      }

      // if (ev.detail[i].appId === (window as any).getApprovalAppId()) {
      //   continue;
      // }
      // if (
      //   ev.detail[i].appId === '4244cb5a7ca479ef01' ||
      //   ev.detail[i].appId === 'a14ca039c667179cdc'
      // ) {
      //   continue;
      // }
      result.push(ev.detail[i]);
    }
    result.sort((a1, a2) =>
      a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
    );
    const pinAppsArr = JSON.parse(localStorage.getItem('pinAppsArr') || '[]');
    let updatePinAppsArr = this.updatePinAppInfo(pinAppsArr, result);
    updatePinAppsArr = updatePinAppsArr.sort(
      (a1: { name: string }, a2: { name: string }) =>
        a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
    );

    const mergeArr = updatePinAppsArr.concat(result);
    let obj = {};
    let deduplicationArr = mergeArr.reduce(
      (cur: any[], next: { appId: string | number }) => {
        // @ts-ignore
        obj[next.appId] ? '' : (obj[next.appId] = true && cur.push(next));
        return cur;
      },
      []
    );
    let unpinArr = deduplicationArr.slice(
      updatePinAppsArr.length,
      deduplicationArr.length + 1
    );
    const arrLast = this.sortByVpn(unpinArr);
    deduplicationArr = updatePinAppsArr.concat(arrLast);
    this.setState({
      miniProgramList: deduplicationArr,
      loadingState: 2,
      miniProgramListBackUp: deduplicationArr,
    });
  };

  public isSearchMatch = (c: any, searchTerm: string, isName: boolean) => {
    const search = searchTerm.toLowerCase();
    let name = c.name;
    if (name && name.toLowerCase().includes(search) && isName) {
      return true;
    }
    return false;
  };

  private clearSearch = () => {
    const { miniProgramListBackUp } = this.state;
    this.setState({ searchText: '' });
    this.sortAgainByPin(miniProgramListBackUp);
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.focus();
    }
  };

  private handleChange = (event: any) => {
    const { miniProgramListBackUp } = this.state;
    const { value: search } = event.target;

    if (search === '') {
      this.sortAgainByPin(miniProgramListBackUp);
    } else {
      let filteredNameArr = [];
      let keyPosition;
      let sortNameArr = [];
      for (let i = 0; i < miniProgramListBackUp.length; i++) {
        if (this.isSearchMatch(miniProgramListBackUp[i], search, true)) {
          keyPosition = miniProgramListBackUp[i].name
            ?.toLowerCase()
            .indexOf(search.toLowerCase());
          miniProgramListBackUp[i].keyPosition = keyPosition;
          sortNameArr.push(miniProgramListBackUp[i]);
        } else {
          filteredNameArr.push(miniProgramListBackUp[i]);
        }
      }
      sortNameArr = sortNameArr.sort((a, b) => {
        // @ts-ignore
        return a.keyPosition - b.keyPosition;
      });
      this.sortAgainByPin(sortNameArr, search);
    }

    this.setState({ searchText: search });
  };

  public renderPin() {
    return (
      <div
        style={{
          borderRadius: '3px',
          border: '6px solid transparent',
          marginTop: '-50px',
          borderTopColor: '#2090ea',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          borderRightColor: '#2090ea',
        }}
      />
    );
  }
  public renderAppItem(list: any, isUnpinList: boolean) {
    const theList = [];
    const { pinAppsArr } = this.state;
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      const labels = list[i]?.labels || [];
      if (
        isUnpinList &&
        pinAppsArr.find(
          (element: { appId: any }) => element.appId === item.appId
        )
      ) {
        continue;
      }

      theList.push(
        <div
          className={'item'}
          key={i}
          onMouseDown={event => {
            if (event?.button !== 2) {
              const type = item.type;
              if (type === 1) {
                (window as any).sendBrowserOpenUrl(item.h5url);
                return;
              }
              (window as any).openMiniProgramView(item, type);
            } else {
              console.log('open app menu by right click');
              if (localStorage.getItem('pinAppsArr')) {
                if (
                  JSON.parse(localStorage.getItem('pinAppsArr') || '[]').find(
                    (element: { appId: any }) => {
                      return element.appId === item.appId;
                    }
                  )
                ) {
                  this.setState({
                    pinFlag: true,
                  });
                } else {
                  this.setState({
                    pinFlag: false,
                  });
                }
              }
              this.setState({
                currentAppItem: item,
                showAppItemMenu: true,
              });
              this.showAppItemMenu(event);
            }
          }}
        >
          {item.picture && (
            <img className={classNames('avatar')} src={item.picture} />
          )}
          {!item.picture && (
            <div className={classNames('avatar', 'avatar-default')}>App</div>
          )}
          <div className={'mp-content-box'}>
            <p
              className={classNames(
                'name',
                (!Array.isArray(labels) || !labels.length) && 'name-signal'
              )}
            >
              {item.name}
            </p>
            {Array.isArray(labels) && labels.length > 0 && (
              <div className={'mp-label-box'}>
                {labels.map(label => (
                  <div key={label} className={'mp-label'}>
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
          {pinAppsArr.find(
            (element: { appId: any }) => element.appId === item.appId
          ) && this.renderPin()}
        </div>
      );
    }
    return theList;
  }

  public render() {
    const { i18n } = this.props;
    const {
      showAppItemMenu,
      searchText,
      showAppDetailDialog,
      pinAppsArr,
      miniProgramList,
    } = this.state;
    const divHeader = (
      <div className={'header'}>
        <span className={'title'}>{i18n('mainMenuWorkspaceTooltip')}</span>
        <img className={'design-icon1'} src={'./images/workspace-design.svg'} />
        <img className={'design-icon2'} src={'./images/workspace-design.svg'} />
        <img className={'design-icon3'} src={'./images/workspace-design.svg'} />
        <img className={'design-icon4'} src={'./images/workspace-design.svg'} />
      </div>
    );
    const searchAndSumbitDiv = (
      <div>
        <div
          className="module-common-header"
          style={{
            width: '50%',
            borderBottom: 'none',
            marginBottom: '0px',
            float: 'left',
          }}
        >
          <div
            className="module-common-header__search"
            style={{ marginBottom: '0px', marginTop: '24px' }}
          >
            <div role="button" className="module-common-header__search__icon" />
            <input
              style={{ width: '100%' }}
              type="text"
              ref={this.inputRef}
              className="module-common-header__search__input"
              placeholder={this.props.i18n('search')}
              dir="auto"
              value={searchText}
              onChange={this.handleChange}
            />
            {searchText ? (
              <div
                role="button"
                className="module-common-header__search__cancel-icon"
                onClick={this.clearSearch}
              />
            ) : null}
          </div>
        </div>
        <div className={'submit-app-div'}>
          <div className={'file-upload-icon'}></div>
          <span>{i18n('publish_your_app')}</span>
        </div>
      </div>
    );

    const divFooter = (
      <div className={'footer'}>
        {/*<span style={{ fontWeight: 'bold' }}>Chative</span>*/}
        {/*<span>{i18n('would_love_to_hear')}</span>*/}
        <br />
        <br />
        <span style={{ cursor: 'pointer' }}>
          {i18n('open_platform_documentation')}
        </span>
        {/*<br />*/}
        {/*<span*/}
        {/*  className={'btn'}*/}
        {/*  onClick={() => {*/}
        {/*    (window as any).jumpMessage({ conversationId: '+10000' });*/}
        {/*  }}*/}
        {/*>*/}
        {/*  {i18n('start')}*/}
        {/*</span>*/}
      </div>
    );

    // loading
    if (this.state.loadingState === 0) {
      return (
        <>
          {divHeader}
          <div style={{ width: '100%', textAlign: 'center', paddingTop: 50 }}>
            <Spin size="large" />
          </div>
        </>
      );
    }

    // loading failed, retry
    if (this.state.loadingState === 1) {
      return (
        <>
          {divHeader}
          <div style={{ width: '100%', textAlign: 'center', paddingTop: 50 }}>
            <p>Load apps failed, please try again.</p>
            <Button
              onClick={() => {
                if (!(window as any).getMiniProgramList) {
                  return;
                }

                this.setState({ loadingState: 0 });
                const miniProgramList = (window as any).getMiniProgramList();
                if (miniProgramList) {
                  this.setState({ miniProgramList, loadingState: 2 });
                } else {
                  if ((window as any).fetchMiniProgramList) {
                    (window as any).fetchMiniProgramList();
                  }
                }
              }}
            >
              Reload
            </Button>
          </div>
        </>
      );
    }

    if (this.state.miniProgramList.length === 0) {
      return (
        <>
          {divHeader}
          {searchAndSumbitDiv}
          <div
            style={{
              width: '100%',
              textAlign: 'center',
              paddingTop: '20%',
              fontSize: '18px',
            }}
          >
            <img
              style={{ width: '110px', height: '110px' }}
              src={'images/no_app_img.svg'}
            />
            <p>App not found</p>
          </div>
          {divFooter}
        </>
      );
    }

    let pinList = this.updatePinAppInfo(pinAppsArr, miniProgramList);
    pinList = pinList.sort((a1: { name: string }, a2: { name: string }) =>
      a1.name.toLowerCase().localeCompare(a2.name.toLowerCase())
    );
    let searchList: {} | null | undefined = [];
    let renderPinList: string | any[] = [];
    let renderUnpinList: string | any[] = [];
    if (searchText.length > 0) {
      searchList = this.renderAppItem(miniProgramList, false);
    } else {
      renderPinList = this.renderAppItem(pinList, false);
      renderUnpinList = this.renderAppItem(miniProgramList, true);
    }

    return (
      <>
        {divHeader}
        {searchAndSumbitDiv}
        <div
          style={{
            height: 'calc(100% - 289px)',
            width: '100%',
            overflow: 'auto',
          }}
        >
          {searchText.length > 0 ? (
            <div
              className={'pane'}
              style={{
                overflow: showAppItemMenu ? 'hidden' : 'auto',
                height: 'fit-content',
              }}
            >
              {searchList}
            </div>
          ) : (
            <div>
              {renderPinList.length > 0 && (
                <p className={'sort-title'}>Pinned</p>
              )}
              <div
                className={'pane'}
                style={{
                  overflow: showAppItemMenu ? 'hidden' : 'auto',
                  height: 'fit-content',
                }}
              >
                {renderPinList.length > 0 && renderPinList}
              </div>
              {renderUnpinList.length > 0 && (
                <p className={'sort-title'} style={{ marginTop: '0px' }}>
                  Apps
                </p>
              )}
              <div
                className={'pane'}
                style={{
                  overflow: showAppItemMenu ? 'hidden' : 'auto',
                  height: 'fit-content',
                }}
              >
                {renderUnpinList.length && renderUnpinList}
              </div>
            </div>
          )}
        </div>
        {divFooter}
        {showAppItemMenu && this.renderAppItemMenu()}
        {showAppDetailDialog && this.renderAppDetailDialog()}
      </>
    );
  }
}
