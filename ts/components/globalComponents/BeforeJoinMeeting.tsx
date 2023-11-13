import React, { useEffect, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { Avatar } from '../Avatar';
interface PropsType {
  onOk: () => void;
  onCancel: () => void;
  meetingOptions: any;
  // justStart?: boolean;
  buttonCall?: boolean;
}

export default function BeforeJoinMeeting(props: PropsType) {
  const { meetingOptions, onOk, onCancel, buttonCall } = props || {};
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [existUsers, setExistUsers] = useState<Array<string>>([]);
  const [existOtherUsers, setExistOtherUsers] = useState<Array<string>>([]);
  const [meetingName, setMeetingName] = useState('');

  const getUniqueUsers = (users: Array<any>) => {
    const uniqueUsers = [];
    const tempSet = new Set();
    for (let i = 0; i < users.length; i += 1) {
      const ac = users[i].account || users[i];
      if (ac) {
        if (ac.startsWith('web-')) {
          if (!tempSet.has(ac)) {
            uniqueUsers.push(ac);
            tempSet.add(ac);
          }
        } else {
          const setItem = ac
            .replace('ios', '')
            .replace('mac', '')
            .replace('android', '');
          if (!tempSet.has(setItem)) {
            uniqueUsers.push('+' + setItem);
            tempSet.add(setItem);
          }
        }
      }
    }
    return uniqueUsers;
  };

  // async useEffect demo
  // https://devtrium.com/posts/async-functions-useeffect
  useEffect(() => {
    let isSubscribed = true;

    // declare the async data fetching function
    const fetchData = async () => {
      try {
        let res;
        if ((window as any).textsecure.messaging) {
          res = await (
            window as any
          ).textsecure.messaging.getMeetingOnlineUsers(
            meetingOptions.channelName
          );
        }

        if (isSubscribed) {
          setIsLoading(false);
          if (res && res.name) {
            setMeetingName(res.name);
          }

          if (
            buttonCall &&
            res &&
            res.users &&
            res.users.length === 0 &&
            res.userInOtherMeeting &&
            res.userInOtherMeeting.length
          ) {
            console.log(
              'BeforeJoinMeeting.tsx user:' +
                JSON.stringify(res.userInOtherMeeting)
            );
            const tempUsers = getUniqueUsers(res.userInOtherMeeting);
            // todo for debug
            // tempUsers.push('+10000');
            // tempUsers.push('+73896533369');
            // tempUsers.push('+72272261344');
            // tempUsers.push('+21084');
            // tempUsers.push('+70985684427');
            // todo for debug
            setExistOtherUsers(tempUsers);
            return;
          }

          if (res && res.users) {
            console.log(
              'BeforeJoinMeeting.tsx user:' + JSON.stringify(res.users)
            );
            const uniqueUsers = getUniqueUsers(res.users);
            // todo for debug
            // uniqueUsers.push('+10000');
            // uniqueUsers.push('+73896533369');
            // uniqueUsers.push('+72272261344');
            // uniqueUsers.push('+21084');
            // todo for debug
            setExistUsers(uniqueUsers);
          } else {
            setApiError(true);
            return;
          }
        }
      } catch (err) {
        console.log('BeforeJoinMeeting.tsx error:', err);
        if (isSubscribed) {
          setIsLoading(false);
          setApiError(true);
        }
      }
    };

    // call the function
    fetchData();

    // cancel any future `setData`
    return () => {
      isSubscribed = false;
    };
  }, []);

  const getConversation = (id: string) => {
    if (!id) {
      console.log('conversation not found for:', id);
      return null;
    }

    if (id.startsWith('web-')) {
      return null;
    }
    return (window as any).ConversationController.get(id);
  };

  const getConversationProps = (id: string) => {
    const c = getConversation(id);
    if (c) {
      return {
        ...c.format(),
        isMe: false,
      };
    } else {
      let name = id;
      if (id.startsWith('web-')) {
        const temp = id.replace('web-', '');
        name =
          temp.indexOf('-') > 0 ? temp.substring(0, temp.indexOf('-')) : temp;
      }
      return {
        id,
        name,
        isArchived: false,
        timestamp: 0,
        phoneNumber: id,
        type: 'direct',
        isMe: false,
        lastUpdated: 0,
        unreadCount: 0,
        isSelected: false,
        isTyping: false,
      };
    }
  };

  const getShortUserName = (name: string) => {
    let realName = name.trim();
    if (realName) {
      if (realName.startsWith('web-')) {
      }

      let spacePos = realName.indexOf(' ');
      if (spacePos > 0) {
        realName = realName.substring(0, spacePos);
      }
      spacePos = realName.indexOf('(');
      if (spacePos > 0) {
        realName = realName.substring(0, spacePos);
      }
    }
    return realName;
  };

  const renderTitle = () => {
    if (isLoading) {
      return null;
    }
    return (
      <p className={'title'}>
        {meetingName || meetingOptions.meetingName || 'Wea Meeting'}
      </p>
    );
  };

  const renderOtherInMeetingSubTitle = () => {
    if (existOtherUsers?.length) {
      return <p className={'body-text'}>Ready to start?</p>;
    }
    return null;
  };

  const renderBody = () => {
    // if (justStart) {
    //   return <p className={'body-text'}>Ready to start?</p>;
    // }
    if (apiError) {
      // return <Alert message="Network Error" type="error" showIcon />;
      return null;
    }
    if (isLoading) {
      return (
        <div className={'avatar-container'}>
          <Spin size="large" tip="Loading..." />
        </div>
      );
    }

    // user in other meeting
    if (existOtherUsers.length === 1) {
      const avatarItem = getConversationProps(existOtherUsers[0]);
      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const msg = realName + ' is in another meeting.';
      return <Alert message={msg} type="info" showIcon />;
    }

    if (existOtherUsers.length === 2) {
      const avatarItem = getConversationProps(existOtherUsers[0]);
      const avatarItem2 = getConversationProps(existOtherUsers[1]);
      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const realName2 = getShortUserName(avatarItem2.name || avatarItem2.id);

      const msg = realName + ' and ' + realName2 + ' are in another meeting.';
      return <Alert message={msg} type="info" showIcon />;
    }
    if (existOtherUsers.length === 3) {
      const avatarItem = getConversationProps(existOtherUsers[0]);
      const avatarItem2 = getConversationProps(existOtherUsers[1]);
      const avatarItem3 = getConversationProps(existOtherUsers[2]);

      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const realName2 = getShortUserName(avatarItem2.name || avatarItem2.id);
      const realName3 = getShortUserName(avatarItem3.name || avatarItem3.id);

      const msg =
        realName +
        ', ' +
        realName2 +
        ' and ' +
        realName3 +
        ' are in another meeting.';
      return <Alert message={msg} type="info" showIcon />;
    }
    if (existOtherUsers.length === 4) {
      const avatarItem = getConversationProps(existOtherUsers[0]);
      const avatarItem2 = getConversationProps(existOtherUsers[1]);
      const avatarItem3 = getConversationProps(existOtherUsers[2]);
      const avatarItem4 = getConversationProps(existOtherUsers[3]);

      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const realName2 = getShortUserName(avatarItem2.name || avatarItem2.id);
      const realName3 = getShortUserName(avatarItem3.name || avatarItem3.id);
      const realName4 = getShortUserName(avatarItem4.name || avatarItem4.id);

      const msg =
        realName +
        ', ' +
        realName2 +
        ', ' +
        realName3 +
        ' and ' +
        realName4 +
        ' are in another meeting.';
      return <Alert message={msg} type="info" showIcon />;
    }
    if (existOtherUsers.length > 4) {
      const avatarItem = getConversationProps(existOtherUsers[0]);
      const avatarItem2 = getConversationProps(existOtherUsers[1]);
      const avatarItem3 = getConversationProps(existOtherUsers[2]);

      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const realName2 = getShortUserName(avatarItem2.name || avatarItem2.id);
      const realName3 = getShortUserName(avatarItem3.name || avatarItem3.id);
      const msg =
        realName +
        ', ' +
        realName2 +
        ', ' +
        realName3 +
        'and ' +
        (existOtherUsers.length - 3) +
        ' more are in another meeting.';
      return <Alert message={msg} type="info" showIcon />;
    }

    // no one
    if (existUsers.length === 0) {
      if (buttonCall) {
        return <p className={'body-text'}>Ready to start?</p>;
      }
      return <p className={'body-text'}>No one else is here. Ready to Join?</p>;
    }

    // only one
    if (existUsers.length === 1) {
      const avatarItem = getConversationProps(existUsers[0]);
      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      return (
        <>
          <p className={'body-text'}>
            {realName + ' is in this meeting. Ready to Join?'}
          </p>
          <div className={'avatar-container'}>
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem.id}
              name={realName}
              avatarPath={(avatarItem as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem.id.startsWith('web-')}
            />
          </div>
        </>
      );
    }

    // only two
    if (existUsers.length === 2) {
      const avatarItem = getConversationProps(existUsers[0]);
      const avatarItem2 = getConversationProps(existUsers[1]);

      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const realName2 = getShortUserName(avatarItem2.name || avatarItem2.id);

      return (
        <>
          <p className={'body-text'}>
            {realName +
              ' and ' +
              realName2 +
              ' are in this meeting. Ready to Join?'}
          </p>
          <div className={'avatar-container'}>
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem.id}
              name={realName}
              avatarPath={(avatarItem as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem.id.startsWith('web-')}
            />
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem2.id}
              name={realName2}
              avatarPath={(avatarItem2 as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem2.id.startsWith('web-')}
            />
          </div>
        </>
      );
    }

    // only three
    if (existUsers.length === 3) {
      const avatarItem = getConversationProps(existUsers[0]);
      const avatarItem2 = getConversationProps(existUsers[1]);
      const avatarItem3 = getConversationProps(existUsers[2]);

      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const realName2 = getShortUserName(avatarItem2.name || avatarItem2.id);
      const realName3 = getShortUserName(avatarItem3.name || avatarItem3.id);

      return (
        <>
          <p className={'body-text'}>
            {realName +
              ', ' +
              realName2 +
              ' and ' +
              realName3 +
              ' are in this meeting. Ready to Join?'}
          </p>
          <div className={'avatar-container'}>
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem.id}
              name={realName}
              avatarPath={(avatarItem as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem.id.startsWith('web-')}
            />
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem2.id}
              name={realName2}
              avatarPath={(avatarItem2 as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem2.id.startsWith('web-')}
            />
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem3.id}
              name={realName3}
              avatarPath={(avatarItem3 as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem3.id.startsWith('web-')}
            />
          </div>
        </>
      );
    }

    // only four
    if (existUsers.length === 4) {
      const avatarItem = getConversationProps(existUsers[0]);
      const avatarItem2 = getConversationProps(existUsers[1]);
      const avatarItem3 = getConversationProps(existUsers[2]);
      const avatarItem4 = getConversationProps(existUsers[3]);

      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const realName2 = getShortUserName(avatarItem2.name || avatarItem2.id);
      const realName3 = getShortUserName(avatarItem3.name || avatarItem3.id);
      const realName4 = getShortUserName(avatarItem4.name || avatarItem4.id);

      return (
        <>
          <p className={'body-text'}>
            {realName +
              ', ' +
              realName2 +
              ', ' +
              realName3 +
              ' and ' +
              realName4 +
              ' are in this meeting. Ready to Join?'}
          </p>
          <div className={'avatar-container'}>
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem.id}
              name={realName}
              avatarPath={(avatarItem as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem.id.startsWith('web-')}
            />
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem2.id}
              name={realName2}
              avatarPath={(avatarItem2 as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem2.id.startsWith('web-')}
            />
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem3.id}
              name={realName3}
              avatarPath={(avatarItem3 as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem3.id.startsWith('web-')}
            />
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem4.id}
              name={realName4}
              avatarPath={(avatarItem4 as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem4.id.startsWith('web-')}
            />
          </div>
        </>
      );
    }

    // more than four
    if (existUsers.length > 4) {
      const avatarItem = getConversationProps(existUsers[0]);
      const avatarItem2 = getConversationProps(existUsers[1]);
      const avatarItem3 = getConversationProps(existUsers[2]);

      const realName = getShortUserName(avatarItem.name || avatarItem.id);
      const realName2 = getShortUserName(avatarItem2.name || avatarItem2.id);
      const realName3 = getShortUserName(avatarItem3.name || avatarItem3.id);

      const maxUserLen =
        existUsers.length - 3 >= 99 ? 99 : existUsers.length - 3;
      return (
        <>
          <p className={'body-text'}>
            {realName +
              ', ' +
              realName2 +
              ', ' +
              realName3 +
              ' and ' +
              (existUsers.length - 3) +
              ' more are in this meeting. Ready to Join?'}
          </p>
          <div className={'avatar-container'}>
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem.id}
              name={realName}
              avatarPath={(avatarItem as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem.id.startsWith('web-')}
            />
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem2.id}
              name={realName2}
              avatarPath={(avatarItem2 as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem2.id.startsWith('web-')}
            />
            <Avatar
              i18n={(window as any).i18n}
              size={36}
              conversationType={'direct'}
              id={avatarItem3.id}
              name={realName3}
              avatarPath={(avatarItem3 as any).avatarPath}
              noteToSelf={false}
              notShowStatus={true}
              noClickEvent={avatarItem3.id.startsWith('web-')}
            />
            <div className={'avatarPlus'}>{'+' + maxUserLen}</div>
          </div>
        </>
      );
    }

    console.log('BeforeJoinMeeting.tsx renderBody error!');
    return null;
  };

  const renderFooter = () => {
    let okText = 'Start';
    if (!buttonCall || existUsers?.length) {
      okText = 'Join';
    }

    return (
      <div className={'foot'}>
        <Button onClick={onCancel} ghost className={'btnGhostBorder'}>
          Cancel
        </Button>
        <Button
          type="primary"
          onClick={onOk}
          ref={ref => {
            ref?.focus();
          }}
        >
          {okText}
        </Button>
      </div>
    );
  };

  return (
    <div className={'before-join-meeting-root'}>
      {renderTitle()}
      {renderOtherInMeetingSubTitle()}
      {renderBody()}
      {renderFooter()}
    </div>
  );
}
