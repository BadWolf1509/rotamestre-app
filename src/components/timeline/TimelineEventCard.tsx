/**
 * TimelineEventCard - Individual event card in the timeline
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';

import { formatRelativeTime, calculateDurationBetween } from '@/lib/utils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { type TimelineEvent, DESCRIPTION_TRUNCATE_LENGTH } from './types';

interface TimelineEventCardProps {
  event: TimelineEvent;
  isLastInGroup: boolean;
  nextEvent?: TimelineEvent;
  isExpanded: boolean;
  onToggleExpand: () => void;
  pulseAnim?: Animated.Value;
}

function TimelineEventCardComponent({
  event,
  isLastInGroup,
  nextEvent,
  isExpanded,
  onToggleExpand,
  pulseAnim,
}: TimelineEventCardProps) {
  const { theme } = useUnistyles();

  const hasLongDescription = event.fullDescription &&
    event.fullDescription.length > DESCRIPTION_TRUNCATE_LENGTH;
  const showPhoto = event.hasPhoto;

  // Container animado para eventos críticos
  const EventContainer = event.isCritical && pulseAnim ? Animated.View : View;
  const containerStyle = event.isCritical && pulseAnim
    ? [styles.eventContainer, { transform: [{ scale: pulseAnim }] }]
    : styles.eventContainer;

  // Duração entre eventos
  const renderDuration = () => {
    if (!nextEvent) return null;
    const duration = calculateDurationBetween(nextEvent.timestamp, event.timestamp);
    if (!duration) return null;

    return (
      <View style={styles.durationContainer}>
        <Text style={styles.durationText}>{duration}</Text>
      </View>
    );
  };

  return (
    <View>
      <EventContainer style={containerStyle}>
        {/* Timeline line */}
        {!isLastInGroup && <View style={styles.timelineLine} />}

        {/* Icon */}
        <View style={[
          styles.iconContainer,
          { backgroundColor: event.color },
          event.isCritical && styles.iconContainerCritical,
        ]}>
          <Ionicons name={event.icon} size={20} color={theme.colors.white} />
        </View>

        {/* Content */}
        <TouchableOpacity
          style={[
            styles.contentContainer,
            event.isCritical && styles.contentContainerCritical,
            event.isNew && styles.contentContainerNew,
          ]}
          onPress={() => hasLongDescription && onToggleExpand()}
          activeOpacity={hasLongDescription ? 0.7 : 1}
          accessibilityRole="button"
          accessibilityLabel={`${event.title}. ${event.description}. ${formatRelativeTime(event.timestamp)}${event.isUnseen ? '. Novo evento' : ''}${event.isCritical ? '. Evento crítico' : ''}`}
          accessibilityHint={hasLongDescription ? 'Toque para expandir detalhes' : undefined}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{event.title}</Text>
              {event.isUnseen && (
                <View style={styles.unseenBadge}>
                  <Text style={styles.unseenBadgeText}>NOVO</Text>
                </View>
              )}
              {showPhoto && (
                <Ionicons
                  name="camera"
                  size={14}
                  color={theme.colors.success}
                  style={styles.photoIcon}
                  accessibilityLabel="Tem foto anexada"
                />
              )}
              {event.isCritical && (
                <View style={styles.criticalBadge}>
                  <Text style={styles.criticalBadgeText}>!</Text>
                </View>
              )}
            </View>
            <Text style={styles.timestamp}>
              {formatRelativeTime(event.timestamp)}
            </Text>
          </View>

          <Text
            style={styles.description}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {isExpanded ? event.fullDescription : event.description}
          </Text>

          {hasLongDescription && (
            <TouchableOpacity
              onPress={onToggleExpand}
              style={styles.expandButton}
            >
              <Text style={styles.expandButtonText}>
                {isExpanded ? 'ver menos' : 'ver mais'}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={theme.colors.info}
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </EventContainer>

      {/* Duration between events */}
      {renderDuration()}
    </View>
  );
}

export const TimelineEventCard = memo(TimelineEventCardComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  eventContainer: {
    flexDirection: 'row',
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 35,
    top: 40,
    bottom: -16,
    width: 2,
    backgroundColor: theme.colors.gray200,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
    borderWidth: 3,
    borderColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: theme.spacing.xs,
    elevation: 3,
  },
  iconContainerCritical: {
    borderColor: theme.colors.red100,
    shadowColor: theme.colors.error,
    shadowOpacity: 0.3,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  contentContainerCritical: {
    backgroundColor: theme.colors.red50,
    borderColor: theme.colors.red100,
  },
  contentContainerNew: {
    backgroundColor: theme.colors.blue50,
    borderColor: theme.colors.blue100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  photoIcon: {
    marginLeft: theme.spacing.xs + 2,
  },
  criticalBadge: {
    backgroundColor: theme.colors.error,
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs + 2,
  },
  criticalBadgeText: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  unseenBadge: {
    backgroundColor: theme.colors.info,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  unseenBadgeText: {
    fontSize: theme.typography.fontSize.xs - 3,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginLeft: theme.spacing.sm,
  },
  description: {
    fontSize: theme.typography.fontSize.xs + 1,
    color: theme.colors.gray600,
    lineHeight: theme.typography.fontSize.sm * 1.3,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  expandButtonText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.info,
    fontFamily: theme.typography.fontSansMedium,
  },
  durationContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    marginLeft: 36,
  },
  durationText: {
    fontSize: theme.typography.fontSize.xs - 2,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
