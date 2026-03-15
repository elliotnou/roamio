import { useState } from 'react';
import {
  View, Text, ScrollView, Image, Pressable, StyleSheet,
  Dimensions, Alert, Modal, TextInput, Platform, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTripStore } from '../../../store/trip-store';
import { ActivityIcon } from '../../../components/ActivityIcon';
import { C } from '../../../lib/colors';
import { F } from '../../../lib/fonts';
import { buildTripCalendarIcs } from '../../../lib/ics';
import { formatDate, getDayCount, getEnergyColor, getEnergyLabel } from '../../../lib/utils';
import type { ActivityBlock } from '../../../types';

const TABS = ['Itinerary', 'Activities', 'Details'] as const;
const SCREEN_W = Dimensions.get('window').width;

// ─── helpers ────────────────────────────────────────────────────────────────

function parseTime(s: string): Date | null {
  const minutes = getClockMinutes(s);
  if (minutes == null) return null;
  return clockDateFromMinutes(minutes);
}

function getClockMinutes(value: string | Date): number | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.getHours() * 60 + value.getMinutes();
  }

  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  // Preferred input shape in app state.
  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1]);
    const minutes = Number(hhmmMatch[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  // Support persisted ISO values.
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getHours() * 60 + parsed.getMinutes();
}

function clockDateFromMinutes(totalMinutes: number): Date {
  const date = new Date(2000, 0, 1, 0, 0, 0, 0);
  date.setMinutes(Math.max(0, totalMinutes));
  return date;
}

function normalizeClockDate(value: Date): Date {
  const minutes = getClockMinutes(value);
  return clockDateFromMinutes(minutes ?? 0);
}

function formatLocalTimestamp(baseDate: string, clockValue: Date): string {
  const date = new Date(`${baseDate}T00:00:00`);
  date.setHours(clockValue.getHours(), clockValue.getMinutes(), 0, 0);
  // Persist as full ISO with timezone so timestamptz preserves the intended local clock time.
  return date.toISOString();
}

function getTripDayDate(tripStartDate: string, dayIndex: number): string {
  const date = new Date(`${tripStartDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const da = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function fmtTime(s: string): string {
  const d = parseTime(s);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtTimePicker(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function durationLabel(start: string | Date, end: string | Date): string {
  const startMinutes = getClockMinutes(start);
  const endMinutes = getClockMinutes(end);
  if (startMinutes == null || endMinutes == null) return '';
  const min = endMinutes - startMinutes;
  if (min <= 0) return '';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function gapMinutes(a: ActivityBlock, b: ActivityBlock): number {
  const endMinutes = getClockMinutes(a.end_time);
  const startMinutes = getClockMinutes(b.start_time);
  if (endMinutes == null || startMinutes == null) return 0;
  return startMinutes - endMinutes;
}

function blockColor(block: ActivityBlock): string {
  if (block.energy_cost_estimate >= 7) return '#c47a6e';
  if (block.energy_cost_estimate >= 4) return '#b8a06a';
  return C.sage;
}

/** Returns the first block (excluding self) that overlaps [start, end] */
function findConflict(
  blocks: ActivityBlock[],
  start: Date,
  end: Date,
  excludeId?: string,
): ActivityBlock | null {
  const s = getClockMinutes(start);
  const e = getClockMinutes(end);
  if (s == null || e == null) return null;

  for (const b of blocks) {
    if (b.id === excludeId) continue;
    const bs = getClockMinutes(b.start_time) ?? 0;
    const be = getClockMinutes(b.end_time) ?? 0;
    if (s < be && e > bs) return b;
  }
  return null;
}

function nudgeDate(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

// ─── Edit Activity Sheet ─────────────────────────────────────────────────────

function EditSheet({
  block,
  tripStartDate,
  siblingBlocks,
  onSave,
  onDelete,
  onClose,
}: {
  block: ActivityBlock;
  tripStartDate: string;
  siblingBlocks: ActivityBlock[];   // same day, excluding self
  onSave: (updates: { place_name: string; start_time: string; end_time: string }) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(block.place_name);
  const [start, setStart] = useState<Date>(parseTime(block.start_time) ?? clockDateFromMinutes(9 * 60));
  const [end, setEnd]     = useState<Date>(parseTime(block.end_time)   ?? clockDateFromMinutes(10 * 60));
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [saving, setSaving] = useState(false);

  const conflict = findConflict(siblingBlocks, start, end);
  const dur = durationLabel(start, end);
  const startMinutes = getClockMinutes(start) ?? 0;
  const endMinutes = getClockMinutes(end) ?? 0;
  const validTime = endMinutes > startMinutes;

  // Nudge start + keep duration
  const nudgeMove = (minutes: number) => {
    const duration = endMinutes - startMinutes;
    const newStart = nudgeDate(start, minutes);
    setStart(newStart);
    setEnd(new Date(newStart.getTime() + duration));
  };

  // Nudge end only (resize)
  const nudgeEnd = (minutes: number) => {
    setEnd(nudgeDate(end, minutes));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const tripDate = getTripDayDate(tripStartDate, block.day_index);
      await onSave({
        place_name: name.trim(),
        start_time: formatLocalTimestamp(tripDate, start),
        end_time: formatLocalTimestamp(tripDate, end),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={es.sheet}>
      <View style={es.handle} />

      {/* Header */}
      <View style={es.header}>
        <Text style={es.title}>Edit Activity</Text>
        <Pressable onPress={onClose} style={es.closeBtn}>
          <Feather name="x" size={18} color={C.secondary} />
        </Pressable>
      </View>

      {/* Name */}
      <View style={es.nameRow}>
        <Feather name="map-pin" size={15} color={C.sage} />
        <TextInput
          style={es.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Activity name"
          placeholderTextColor={C.placeholder}
          autoCorrect={false}
        />
      </View>

      {/* Time section */}
      <Text style={es.sectionLabel}>TIME</Text>

      {/* Start time */}
      <View style={es.timeBlock}>
        <Text style={es.timeBlockLabel}>Start</Text>
        <View style={es.timeControls}>
          <Pressable style={es.nudgeBtn} onPress={() => nudgeMove(-15)}>
            <Feather name="minus" size={14} color={C.secondary} />
          </Pressable>
          <Pressable style={es.timeValue} onPress={() => setPicker('start')}>
            <Text style={es.timeValueText}>{fmtTimePicker(start)}</Text>
            <Feather name="chevron-down" size={14} color={C.placeholder} />
          </Pressable>
          <Pressable style={es.nudgeBtn} onPress={() => nudgeMove(15)}>
            <Feather name="plus" size={14} color={C.secondary} />
          </Pressable>
        </View>
      </View>

      {/* End time */}
      <View style={es.timeBlock}>
        <Text style={es.timeBlockLabel}>End</Text>
        <View style={es.timeControls}>
          <Pressable style={es.nudgeBtn} onPress={() => nudgeEnd(-15)}>
            <Feather name="minus" size={14} color={C.secondary} />
          </Pressable>
          <Pressable style={es.timeValue} onPress={() => setPicker('end')}>
            <Text style={es.timeValueText}>{fmtTimePicker(end)}</Text>
            <Feather name="chevron-down" size={14} color={C.placeholder} />
          </Pressable>
          <Pressable style={es.nudgeBtn} onPress={() => nudgeEnd(15)}>
            <Feather name="plus" size={14} color={C.secondary} />
          </Pressable>
        </View>
      </View>

      {/* Duration + conflict */}
      <View style={es.metaRow}>
        {validTime && dur ? (
          <View style={es.durChip}>
            <Feather name="clock" size={12} color={C.secondary} />
            <Text style={es.durText}>{dur}</Text>
          </View>
        ) : (
          <View style={[es.durChip, { backgroundColor: C.eLowBg }]}>
            <Feather name="alert-circle" size={12} color={C.eLowText} />
            <Text style={[es.durText, { color: C.eLowText }]}>End must be after start</Text>
          </View>
        )}
        {conflict && (
          <View style={es.conflictChip}>
            <Feather name="alert-triangle" size={12} color={C.eLowText} />
            <Text style={es.conflictText} numberOfLines={1}>
              Overlaps "{conflict.place_name}"
            </Text>
          </View>
        )}
      </View>

      {/* Footer actions */}
      <View style={es.footer}>
        <Pressable style={es.deleteBtn} onPress={onDelete}>
          <Feather name="trash-2" size={15} color={C.eLowText} />
          <Text style={es.deleteBtnText}>Remove</Text>
        </Pressable>
        <Pressable
          style={[es.saveBtn, (!name.trim() || !validTime || !!conflict || saving) && es.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || !validTime || !!conflict || saving}
        >
          <Text style={es.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>
      </View>

      {/* DateTimePicker inline */}
      {picker !== null && (
        <View style={es.pickerWrap}>
          <View style={es.pickerHeader}>
            <Text style={es.pickerTitle}>{picker === 'start' ? 'Start time' : 'End time'}</Text>
            <Pressable onPress={() => setPicker(null)}>
              <Text style={es.pickerDone}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={picker === 'start' ? start : end}
            mode="time"
            display="spinner"
            minuteInterval={15}
            textColor={C.fg}
            onChange={(event, date) => {
              if (event.type !== 'set' || !date) {
                if (Platform.OS === 'android') setPicker(null);
                return;
              }
              const normalized = normalizeClockDate(date);
              if (picker === 'start') {
                const duration = end.getTime() - start.getTime();
                setStart(normalized);
                setEnd(new Date(normalized.getTime() + duration));
              } else {
                setEnd(normalized);
              }
              if (Platform.OS === 'android') setPicker(null);
            }}
          />
        </View>
      )}
    </View>
  );
}

// ─── Itinerary tab ───────────────────────────────────────────────────────────

function ItineraryTab({
  blocks, dayCount, activeDay, setActiveDay, checkedInIds,
  onCheckIn, onEdit, onAddActivity,
}: {
  blocks: ActivityBlock[];
  dayCount: number;
  activeDay: number;
  setActiveDay: (d: number) => void;
  checkedInIds: Set<string>;
  onCheckIn: (id: string) => void;
  onEdit: (block: ActivityBlock) => void;
  onAddActivity: () => void;
}) {
  const dayBlocks = blocks
    .filter(b => b.day_index === activeDay)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Build a conflict set for this day
  const conflictIds = new Set<string>();
  for (let i = 0; i < dayBlocks.length; i++) {
    for (let j = i + 1; j < dayBlocks.length; j++) {
      const ai = getClockMinutes(dayBlocks[i].start_time);
      const bi = getClockMinutes(dayBlocks[i].end_time);
      const aj = getClockMinutes(dayBlocks[j].start_time);
      const bj = getClockMinutes(dayBlocks[j].end_time);
      if (ai != null && bi != null && aj != null && bj != null && ai < bj && bi > aj) {
        conflictIds.add(dayBlocks[i].id);
        conflictIds.add(dayBlocks[j].id);
      }
    }
  }

  return (
    <View>
      {/* Day pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={il.dayRow}>
        {Array.from({ length: dayCount }, (_, i) => {
          const cnt = blocks.filter(b => b.day_index === i).length;
          return (
            <Pressable key={i} onPress={() => setActiveDay(i)}
              style={[il.dayPill, activeDay === i && il.dayPillActive]}>
              <Text style={[il.dayPillText, activeDay === i && il.dayPillTextActive]}>Day {i + 1}</Text>
              {cnt > 0 && (
                <View style={[il.dayCnt, activeDay === i && il.dayCntActive]}>
                  <Text style={[il.dayCntText, activeDay === i && il.dayCntTextActive]}>{cnt}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Empty state */}
      {dayBlocks.length === 0 ? (
        <View style={il.empty}>
          <View style={il.emptyIcon}><Feather name="sun" size={24} color={C.placeholder} /></View>
          <Text style={il.emptyTitle}>Free day</Text>
          <Text style={il.emptySub}>Nothing planned yet</Text>
          <Pressable style={il.emptyAdd} onPress={onAddActivity}>
            <Feather name="plus" size={14} color={C.sage} />
            <Text style={il.emptyAddText}>Add an activity</Text>
          </Pressable>
        </View>
      ) : (
        <View style={il.timeline}>
          {dayBlocks.map((block, idx) => {
            const color = blockColor(block);
            const isDone = checkedInIds.has(block.id);
            const isConflict = conflictIds.has(block.id);
            const ec = getEnergyColor(block.energy_cost_estimate);
            const dur = durationLabel(block.start_time, block.end_time);
            const isLast = idx === dayBlocks.length - 1;
            const gap = !isLast ? gapMinutes(block, dayBlocks[idx + 1]) : 0;

            return (
              <View key={block.id}>
                <Pressable style={il.row} onPress={() => onEdit(block)}>
                  {/* Time col */}
                  <View style={il.timeCol}>
                    <Text style={il.timeText}>{fmtTime(block.start_time)}</Text>
                  </View>

                  {/* Spine */}
                  <View style={il.spineCol}>
                    <View style={[
                      il.circle,
                      { backgroundColor: isConflict ? C.eLowText : isDone ? C.sage : color,
                        borderColor: (isConflict ? C.eLowText : isDone ? C.sage : color) + '40' }
                    ]}>
                      {isDone && !isConflict && <Feather name="check" size={8} color={C.white} />}
                      {isConflict && <Feather name="alert-circle" size={8} color={C.white} />}
                    </View>
                    {!isLast && <View style={[il.spineLine, { backgroundColor: isConflict ? C.eLowText + '40' : isDone ? C.sage + '40' : C.border }]} />}
                  </View>

                  {/* Card */}
                  <View style={[
                    il.card,
                    { borderLeftColor: isConflict ? C.eLowText : isDone ? C.sage : color },
                    isConflict && il.cardConflict,
                  ]}>
                    {/* Top row: name + energy badge + edit hint */}
                    <View style={il.cardTop}>
                      <View style={il.cardTitleRow}>
                        <ActivityIcon type={block.activity_type} size={13} color={isConflict ? C.eLowText : isDone ? C.sage : color} />
                        <Text style={il.cardName} numberOfLines={2}>{block.place_name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[il.energyBadge, { backgroundColor: ec.bg }]}>
                          <Text style={[il.energyText, { color: ec.text }]}>{getEnergyLabel(block.energy_cost_estimate)}</Text>
                        </View>
                        <Feather name="edit-2" size={12} color={C.placeholder} />
                      </View>
                    </View>

                    {/* Conflict warning */}
                    {isConflict && (
                      <View style={il.conflictRow}>
                        <Feather name="alert-triangle" size={11} color={C.eLowText} />
                        <Text style={il.conflictText}>Time conflict — tap to fix</Text>
                      </View>
                    )}

                    {/* Meta */}
                    {dur ? (
                      <View style={il.metaRow}>
                        <Feather name="clock" size={11} color={C.placeholder} />
                        <Text style={il.metaText}>{fmtTime(block.start_time)} – {fmtTime(block.end_time)}  ·  {dur}</Text>
                      </View>
                    ) : null}

                    {/* Check-in / done */}
                    {isDone ? (
                      <View style={il.doneRow}>
                        <View style={il.doneDot} />
                        <Text style={il.doneText}>Checked in</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[il.checkInBtn, { borderColor: color }]}
                        onPress={(e) => { e.stopPropagation?.(); onCheckIn(block.id); }}
                      >
                        <Feather name="check-circle" size={13} color={color} />
                        <Text style={[il.checkInText, { color }]}>Check in</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>

                {/* Gap indicator */}
                {!isLast && gap >= 30 && (
                  <View style={il.gapRow}>
                    <View style={il.timeCol} />
                    <View style={il.spineCol}>
                      <View style={il.gapLine} />
                    </View>
                    <Pressable style={il.gapPill} onPress={onAddActivity}>
                      <Feather name="plus" size={11} color={C.placeholder} />
                      <Text style={il.gapText}>{gap < 60 ? `${gap}m free` : `${Math.floor(gap / 60)}h ${gap % 60 ? `${gap % 60}m ` : ''}free`}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

          {/* End node */}
          <View style={il.endRow}>
            <View style={il.timeCol} />
            <View style={il.spineCol}><View style={il.endDot} /></View>
            <Text style={il.endText}>End of day</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Activities tab ───────────────────────────────────────────────────────────

function ActivitiesTab({ blocks, checkedInIds }: { blocks: ActivityBlock[]; checkedInIds: Set<string> }) {
  const done = blocks.filter(b => checkedInIds.has(b.id)).length;
  const progress = blocks.length > 0 ? done / blocks.length : 0;

  const groups: Record<string, ActivityBlock[]> = {};
  blocks.forEach(b => {
    if (!groups[b.activity_type]) groups[b.activity_type] = [];
    groups[b.activity_type].push(b);
  });

  if (blocks.length === 0) {
    return (
      <View style={at.empty}>
        <View style={at.emptyIcon}><Feather name="list" size={24} color={C.placeholder} /></View>
        <Text style={at.emptyTitle}>No activities yet</Text>
        <Text style={at.emptyText}>Add activities to your itinerary to see them here</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={at.progressCard}>
        <Text style={at.progressCount}>{done}/{blocks.length}</Text>
        <Text style={at.progressLabel}>Activities checked in</Text>
        <View style={at.progressBar}>
          <View style={[at.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <View style={at.progressStats}>
          <Text style={at.stat}><Text style={at.statBold}>{blocks.length - done}</Text> remaining</Text>
          <Text style={{ color: C.border }}>·</Text>
          <Text style={at.stat}><Text style={at.statBold}>{done}</Text> completed</Text>
        </View>
      </View>

      {Object.entries(groups).map(([type, typeBlocks]) => (
        <View key={type} style={at.group}>
          <View style={at.groupHeader}>
            <ActivityIcon type={type as any} size={15} color={C.sage} />
            <Text style={at.groupTitle}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
            <View style={at.groupBadge}><Text style={at.groupBadgeText}>{typeBlocks.length}</Text></View>
          </View>
          {typeBlocks.map(block => {
            const isDone = checkedInIds.has(block.id);
            const ec = getEnergyColor(block.energy_cost_estimate);
            return (
              <View key={block.id} style={[at.row, isDone && at.rowDone]}>
                <View style={[at.dot, { backgroundColor: isDone ? C.sage : blockColor(block) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[at.name, isDone && at.nameDone]}>{block.place_name}</Text>
                  <Text style={at.meta}>{fmtTime(block.start_time)}  ·  Day {block.day_index + 1}</Text>
                </View>
                <View style={[at.tag, { backgroundColor: ec.bg }]}>
                  <Text style={[at.tagText, { color: ec.text }]}>{getEnergyLabel(block.energy_cost_estimate)}</Text>
                </View>
                {isDone && <Feather name="check-circle" size={15} color={C.sage} style={{ marginLeft: 6 }} />}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Details tab ──────────────────────────────────────────────────────────────

function DetailsTab({ trip, blocks, checkInCount }: { trip: any; blocks: ActivityBlock[]; checkInCount: number }) {
  const high = blocks.filter(b => b.energy_cost_estimate >= 7).length;
  const low  = blocks.filter(b => b.energy_cost_estimate <= 3).length;
  const med  = blocks.length - high - low;
  const balance = blocks.length > 0 ? Math.round(((med + low) / blocks.length) * 100) : 0;

  const VIBES: Record<string, { icon: React.ComponentProps<typeof Feather>['name']; color: string; desc: string }> = {
    relaxing:  { icon: 'sunset',    color: '#b8a06a', desc: 'Restorative, slow-paced' },
    adventure: { icon: 'compass',   color: '#c47a6e', desc: 'Active exploration' },
    culture:   { icon: 'book-open', color: C.sage,   desc: 'Art, history & context' },
    foodie:    { icon: 'coffee',    color: '#a87c5e', desc: 'Culinary discovery' },
  };

  return (
    <View>
      <View style={dt.card}>
        <Text style={dt.cardTitle}>Wellness Balance</Text>
        <Text style={dt.cardSub}>Energy distribution across your trip</Text>
        <View style={dt.bar}>
          {blocks.length > 0 ? (
            <>
              <View style={[dt.seg, { flex: Math.max(low, 0.01), backgroundColor: C.sage }]} />
              <View style={[dt.seg, { flex: Math.max(med, 0.01), backgroundColor: '#b8a06a' }]} />
              <View style={[dt.seg, { flex: Math.max(high, 0.01), backgroundColor: '#c47a6e' }]} />
            </>
          ) : <View style={[dt.seg, { flex: 1, backgroundColor: C.border }]} />}
        </View>
        <View style={dt.legend}>
          {[{c: C.sage, l:`Low (${low})`},{c:'#b8a06a',l:`Med (${med})`},{c:'#c47a6e',l:`High (${high})`}].map(x => (
            <View key={x.l} style={dt.legendItem}>
              <View style={[dt.legendDot, { backgroundColor: x.c }]} />
              <Text style={dt.legendText}>{x.l}</Text>
            </View>
          ))}
        </View>
        <View style={dt.scoreRow}>
          <Text style={dt.scoreNum}>{balance}%</Text>
          <Text style={dt.scoreSub}>of activities are rest-friendly</Text>
        </View>
      </View>

      {trip.travel_vibes?.length > 0 && (
        <View style={dt.section}>
          <Text style={dt.sectionTitle}>Trip Vibes</Text>
          <View style={dt.vibesRow}>
            {trip.travel_vibes.map((v: string) => {
              const info = VIBES[v]; if (!info) return null;
              return (
                <View key={v} style={[dt.vibeCard, { borderColor: info.color + '40' }]}>
                  <View style={[dt.vibeIcon, { backgroundColor: info.color + '15' }]}>
                    <Feather name={info.icon} size={18} color={info.color} />
                  </View>
                  <Text style={[dt.vibeName, { color: info.color }]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
                  <Text style={dt.vibeDesc}>{info.desc}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={dt.section}>
        <Text style={dt.sectionTitle}>Stats</Text>
        <View style={dt.statsRow}>
          {[
            { icon: 'layers' as const, value: blocks.length, label: 'Activities', color: C.sage },
            { icon: 'check-circle' as const, value: checkInCount, label: 'Check-ins', color: '#b8a06a' },
            { icon: 'calendar' as const, value: getDayCount(trip.start_date, trip.end_date), label: 'Days', color: '#c47a6e' },
          ].map(st => (
            <View key={st.label} style={dt.statCard}>
              <Feather name={st.icon} size={20} color={st.color} />
              <Text style={dt.statValue}>{st.value}</Text>
              <Text style={dt.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={dt.aiNote}>
        <View style={dt.aiNoteIcon}><Feather name="cpu" size={18} color={C.sage} /></View>
        <View style={{ flex: 1 }}>
          <Text style={dt.aiTitle}>Roamio AI is watching your energy</Text>
          <Text style={dt.aiText}>Check in before each activity and Roamio will suggest gentler alternatives whenever your energy dips.</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, activityBlocks, checkIns, deleteActivityBlock, updateActivityBlock } = useTripStore();
  const insets = useSafeAreaInsets();

  const trip = trips.find(t => t.id === tripId);
  const blocks = activityBlocks[tripId ?? ''] || [];
  const checkedInIds = new Set(checkIns.map(c => c.activity_block_id));
  const dayCount = trip ? getDayCount(trip.start_date, trip.end_date) : 0;

  const [activeTab, setActiveTab] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [editingBlock, setEditingBlock] = useState<ActivityBlock | null>(null);

  const handleSaveEdit = async (updates: { place_name: string; start_time: string; end_time: string }) => {
    if (!editingBlock) return false;
    const updated = await updateActivityBlock(editingBlock.id, updates);
    if (!updated) {
      Alert.alert('Save failed', 'Could not update this activity. Please try again.');
      return false;
    }
    setEditingBlock(null);
    return true;
  };

  const handleDeleteEdit = () => {
    if (!editingBlock) return;
    const b = editingBlock;
    setEditingBlock(null);
    Alert.alert('Remove activity?', b.place_name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteActivityBlock(b.id, b.trip_id) },
    ]);
  };

  const handleShareCalendar = async () => {
    if (!trip) return;

    try {
      const currentTrip = trip;
      const icsContent = buildTripCalendarIcs(currentTrip, blocks);

      const sanitizedDestination = currentTrip.destination
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const fileName = `${sanitizedDestination || 'trip'}-${currentTrip.id}.ics`;
      const calendarFile = new File(Paths.cache, fileName);
      calendarFile.create({ overwrite: true, intermediates: true });
      calendarFile.write(icsContent);

      const canNativeShare = await Sharing.isAvailableAsync();
      if (canNativeShare) {
        await Sharing.shareAsync(calendarFile.uri, {
          mimeType: 'text/calendar',
          dialogTitle: 'Share itinerary as calendar',
          UTI: 'public.ics',
        });
        return;
      }

      await Share.share({
        title: `${currentTrip.destination} itinerary`,
        message: `Roamio itinerary export:\n${calendarFile.uri}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export this itinerary right now.';
      Alert.alert('Export failed', message);
    }
  };

  if (!trip) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.notFound}>
          <Text style={s.notFoundTitle}>Trip not found</Text>
          <Pressable onPress={() => router.back()}><Text style={s.notFoundLink}>Go back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Siblings for conflict detection in edit sheet (same day, not self)
  const siblingBlocks = editingBlock
    ? blocks.filter(b => b.day_index === editingBlock.day_index && b.id !== editingBlock.id)
    : [];

  return (
    <View style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Hero */}
        <View style={s.hero}>
          {trip.destination_image
            ? <Image source={{ uri: trip.destination_image }} style={s.heroImage} />
            : <View style={[s.heroImage, { backgroundColor: C.sage }]} />}
          <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} />
          <View style={[s.heroOverlay, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={() => router.back()} style={s.heroBtn}>
              <Feather name="chevron-left" size={20} color={C.white} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable style={s.heroBtn} onPress={() => {
                Alert.alert('Delete Trip', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                    const ok = await useTripStore.getState().deleteTrip(trip.id);
                    if (ok) router.replace('/(tabs)');
                    else Alert.alert('Error', 'Failed to delete trip.');
                  }},
                ]);
              }}>
                <Feather name="trash-2" size={18} color={C.white} />
              </Pressable>
              <Pressable style={s.heroBtn} onPress={handleShareCalendar}>
                <Feather name="share" size={18} color={C.white} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Trip info */}
        <View style={s.info}>
          <Text style={s.tripName}>{trip.destination}</Text>
          <View style={s.tripMeta}>
            <Feather name="calendar" size={14} color={C.secondary} />
            <Text style={s.tripDates}>{formatDate(trip.start_date)} – {formatDate(trip.end_date)}</Text>
            <View style={s.dayPill}><Text style={s.dayPillText}>{dayCount}d</Text></View>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {TABS.map((tab, idx) => (
            <Pressable key={tab} onPress={() => setActiveTab(idx)} style={[s.tab, activeTab === idx && s.tabActive]}>
              <Text style={[s.tabText, activeTab === idx && s.tabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: 20 }}>
          {activeTab === 0 && (
            <ItineraryTab
              blocks={blocks}
              dayCount={dayCount}
              activeDay={activeDay}
              setActiveDay={setActiveDay}
              checkedInIds={checkedInIds}
              onCheckIn={id => router.push(`/checkin/${id}` as never)}
              onEdit={setEditingBlock}
              onAddActivity={() => router.push(`/trips/${tripId}/itinerary` as never)}
            />
          )}
          {activeTab === 1 && <ActivitiesTab blocks={blocks} checkedInIds={checkedInIds} />}
          {activeTab === 2 && (
            <DetailsTab
              trip={trip}
              blocks={blocks}
              checkInCount={checkIns.filter(c => blocks.some(b => b.id === c.activity_block_id)).length}
            />
          )}
        </View>

        {/* Add button */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Pressable style={s.addBtn} onPress={() => router.push(`/trips/${tripId}/itinerary` as never)}>
            <Feather name="plus" size={16} color={C.white} />
            <Text style={s.addBtnText}>Add Activity</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit sheet modal */}
      <Modal
        visible={editingBlock !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingBlock(null)}
      >
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEditingBlock(null)} />
          {editingBlock && (
            <EditSheet
              block={editingBlock}
              tripStartDate={trip.start_date}
              siblingBlocks={siblingBlocks}
              onSave={handleSaveEdit}
              onDelete={handleDeleteEdit}
              onClose={() => setEditingBlock(null)}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundTitle: { fontSize: 20, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  notFoundLink: { fontSize: 14, fontFamily: F.semiBold, color: C.sage },
  hero: { width: '100%', height: 320 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16 },
  heroBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  info: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  tripName: { fontSize: 32, fontFamily: F.bold, color: C.fg, letterSpacing: -0.5 },
  tripMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  tripDates: { fontSize: 15, fontFamily: F.medium, color: C.secondary },
  dayPill: { backgroundColor: C.cardBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  dayPillText: { fontSize: 12, fontFamily: F.bold, color: C.secondary },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: C.white },
  tabActive: { backgroundColor: C.charcoal },
  tabText: { fontSize: 14, fontFamily: F.semiBold, color: C.secondary },
  tabTextActive: { color: C.white },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16 },
  addBtnText: { color: C.white, fontSize: 16, fontFamily: F.semiBold },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
});

const il = StyleSheet.create({
  dayRow: { gap: 8, paddingVertical: 4, marginBottom: 8 },
  dayPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.white },
  dayPillActive: { backgroundColor: C.charcoal },
  dayPillText: { fontSize: 13, fontFamily: F.semiBold, color: C.secondary },
  dayPillTextActive: { color: C.white },
  dayCnt: { backgroundColor: C.cardBg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  dayCntActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  dayCntText: { fontSize: 11, fontFamily: F.bold, color: C.secondary },
  dayCntTextActive: { color: C.white },

  empty: { paddingVertical: 56, alignItems: 'center', gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: F.bold, color: C.fg },
  emptySub: { fontSize: 13, fontFamily: F.regular, color: C.secondary },
  emptyAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5, borderColor: C.sage },
  emptyAddText: { fontSize: 14, fontFamily: F.semiBold, color: C.sage },

  timeline: { paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  timeCol: { width: 60, paddingTop: 4 },
  timeText: { fontSize: 12, fontFamily: F.medium, color: C.secondary, textAlign: 'right', paddingRight: 10 },
  spineCol: { width: 24, alignItems: 'center' },
  circle: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  spineLine: { width: 2, flex: 1, minHeight: 12 },

  card: { flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 0, borderLeftWidth: 3, marginLeft: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardConflict: { backgroundColor: C.eLowBg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  cardName: { fontSize: 14, fontFamily: F.bold, color: C.fg, flex: 1 },
  energyBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  energyText: { fontSize: 10, fontFamily: F.semiBold },

  conflictRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  conflictText: { fontSize: 11, fontFamily: F.semiBold, color: C.eLowText },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: F.regular, color: C.placeholder },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  doneDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage },
  doneText: { fontSize: 12, fontFamily: F.medium, color: C.eHighText },
  checkInBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  checkInText: { fontSize: 12, fontFamily: F.semiBold },

  gapRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  gapLine: { width: 2, height: 24, backgroundColor: C.border },
  gapPill: { marginLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.cardBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  gapText: { fontSize: 11, fontFamily: F.medium, color: C.placeholder },

  endRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  endDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.border, borderWidth: 2, borderColor: C.cardBg },
  endText: { marginLeft: 16, fontSize: 12, fontFamily: F.regular, color: C.placeholder },
});

const at = StyleSheet.create({
  empty: { paddingVertical: 56, alignItems: 'center', gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontFamily: F.bold, color: C.fg },
  emptyText: { fontSize: 13, fontFamily: F.regular, color: C.secondary, textAlign: 'center' },
  progressCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
  progressCount: { fontSize: 28, fontFamily: F.bold, color: C.fg },
  progressLabel: { fontSize: 13, fontFamily: F.regular, color: C.secondary, marginBottom: 12 },
  progressBar: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 6, backgroundColor: C.sage, borderRadius: 3 },
  progressStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stat: { fontSize: 13, fontFamily: F.regular, color: C.secondary },
  statBold: { fontFamily: F.bold, color: C.fg },
  group: { marginBottom: 20 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  groupTitle: { fontSize: 15, fontFamily: F.bold, color: C.fg, flex: 1 },
  groupBadge: { backgroundColor: C.cardBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  groupBadgeText: { fontSize: 12, fontFamily: F.bold, color: C.secondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
  rowDone: { opacity: 0.65 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },
  nameDone: { textDecorationLine: 'line-through', color: C.secondary },
  meta: { fontSize: 12, fontFamily: F.regular, color: C.placeholder, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 11, fontFamily: F.semiBold },
});

const dt = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
  cardTitle: { fontSize: 17, fontFamily: F.bold, color: C.fg, marginBottom: 4 },
  cardSub: { fontSize: 12, fontFamily: F.regular, color: C.secondary, marginBottom: 16 },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 14, gap: 2, backgroundColor: C.border },
  seg: { borderRadius: 6 },
  legend: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: F.regular, color: C.secondary },
  scoreRow: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  scoreNum: { fontSize: 28, fontFamily: F.bold, color: C.sage },
  scoreSub: { fontSize: 13, fontFamily: F.regular, color: C.secondary },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontFamily: F.bold, color: C.fg, marginBottom: 14 },
  vibesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vibeCard: { width: (SCREEN_W - 60) / 2, backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
  vibeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  vibeName: { fontSize: 14, fontFamily: F.bold, marginBottom: 4 },
  vibeDesc: { fontSize: 11, fontFamily: F.regular, color: C.placeholder, lineHeight: 15 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
  statValue: { fontSize: 22, fontFamily: F.bold, color: C.fg },
  statLabel: { fontSize: 12, fontFamily: F.regular, color: C.secondary },
  aiNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: C.sage + '12', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.sage + '30' },
  aiNoteIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.sage + '20', justifyContent: 'center', alignItems: 'center' },
  aiTitle: { fontSize: 14, fontFamily: F.bold, color: C.sageDark, marginBottom: 4 },
  aiText: { fontSize: 13, fontFamily: F.regular, color: C.secondary, lineHeight: 18 },
});

// Edit sheet styles
const es = StyleSheet.create({
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center' },

  nameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  nameInput: { flex: 1, fontSize: 16, fontFamily: F.semiBold, color: C.fg },

  sectionLabel: { fontSize: 11, fontFamily: F.bold, color: C.placeholder, letterSpacing: 1, marginHorizontal: 20, marginBottom: 10 },

  timeBlock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 12 },
  timeBlockLabel: { fontSize: 14, fontFamily: F.medium, color: C.secondary, width: 40 },
  timeControls: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nudgeBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.cardBg,
    justifyContent: 'center', alignItems: 'center',
  },
  timeValue: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  timeValueText: { fontSize: 15, fontFamily: F.semiBold, color: C.fg },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 20, marginBottom: 20, marginTop: 4 },
  durChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.cardBg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  durText: { fontSize: 13, fontFamily: F.medium, color: C.secondary },
  conflictChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.eLowBg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, flex: 1 },
  conflictText: { fontSize: 12, fontFamily: F.semiBold, color: C.eLowText, flex: 1 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 4 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 999, borderWidth: 1.5, borderColor: C.eLowText + '50' },
  deleteBtnText: { fontSize: 14, fontFamily: F.semiBold, color: C.eLowText },
  saveBtn: { flex: 1, backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: C.border },
  saveBtnText: { color: C.white, fontSize: 15, fontFamily: F.bold },

  pickerWrap: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 12 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  pickerTitle: { fontSize: 15, fontFamily: F.semiBold, color: C.fg },
  pickerDone: { fontSize: 15, fontFamily: F.semiBold, color: C.sage },
});
