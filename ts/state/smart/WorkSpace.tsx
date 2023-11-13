import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { WorkSpace } from '../../components/WorkSpace';
import { StateType } from '../reducer';
import { getIntl, getUserNumber } from '../selectors/user';

const mapStateToProps = (state: StateType) => {
  return {
    i18n: getIntl(state),
    ourNumber: getUserNumber(state),
  };
};

export const SmartWorkSpace = connect(
  mapStateToProps,
  mapDispatchToProps
)(WorkSpace);
