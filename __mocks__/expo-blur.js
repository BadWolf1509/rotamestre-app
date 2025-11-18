const React = require('react');
const { View } = require('react-native');

module.exports = {
  BlurView: React.forwardRef((props, ref) => React.createElement(View, { ...props, ref })),
};
