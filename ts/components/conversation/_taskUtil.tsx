import moment from 'moment';

export default function timestampToLocal(
  timestamp: number,
  isChinese: boolean
) {
  // console.log('timestampToLocal() timestamp:', timestamp);
  // console.log('timestampToLocal() isChinese:', isChinese);
  moment.locale(isChinese ? 'zh-cn' : 'en');

  let result = '';
  const now = moment();
  let dest = moment(timestamp);

  let week;
  if (dest.startOf('day').valueOf() === now.startOf('day').valueOf()) {
    week = isChinese ? 'Today' : 'Today';
  }

  const yesterday = moment(now.startOf('day').valueOf() - 10);
  if (yesterday.startOf('day').valueOf() === dest.startOf('day').valueOf()) {
    week = isChinese ? 'Yesterday' : 'Yesterday';
  }

  const tomorrow = moment(now.endOf('day').valueOf() + 10);
  if (tomorrow.startOf('day').valueOf() === dest.startOf('day').valueOf()) {
    week = isChinese ? 'Tomorrow' : 'Tomorrow';
  }

  if (!week) {
    week = dest.format('ddd');
  }

  dest = moment(timestamp);
  const sameYear = now.year() === dest.year();
  if (isChinese) {
    if (sameYear) {
      result = dest.format('M月D日 (') + week + dest.format(') HH:mm');
    } else {
      result = dest.format('YYYY年M月D日 HH:mm');
    }
  } else {
    if (sameYear) {
      result = week + dest.format(', MMM D, HH:mm');
    } else {
      result = dest.format('MMM D, YYYY, HH:mm');
    }
  }

  // console.log('timestampToLocal() result:', result);
  return result;
}
