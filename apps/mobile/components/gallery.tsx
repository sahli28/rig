import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '@rig/ui/theme';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  ListRow,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  Switch,
  Tabs,
  Toast,
} from '@rig/ui/native';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space(3) }}>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.caption,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
          letterSpacing: 1,
        }}
      >
        {title.toLocaleUpperCase('fr-FR')}
      </Text>
      {children}
    </View>
  );
}

/**
 * Galerie des 16 composants du kit. Sert de preuve visuelle du thème.
 *
 * Les textes affichés ici sont des **données d'exemple**, pas de la copie
 * produit : « WOD — 18h30 », « Sarah D. », « Complet » remplissent les
 * composants pour qu'on juge leur rendu. Ils ne passent volontairement pas par
 * l'i18n — traduire un jeu de fixtures gonflerait le dictionnaire de clés que
 * personne n'affichera jamais à un membre. Les vrais écrans, eux, y passent.
 */
export function Gallery() {
  const theme = useTheme();
  const [tab, setTab] = useState('planning');
  const [level, setLevel] = useState('rx');
  const [name, setName] = useState('');
  const [coach, setCoach] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.surface }}
      contentContainerStyle={{ padding: theme.space(4), gap: theme.space(7) }}
    >
      {theme.contrast.adjusted ? (
        <Banner
          tone="warning"
          title="Couleur de marque corrigée"
          description={`La couleur ${theme.contrast.requestedPrimary} n'atteignait qu'un contraste de ${theme.contrast.requestedRatio.toFixed(2)}:1. Elle a été ajustée en ${theme.contrast.appliedPrimary} (${theme.contrast.appliedRatio.toFixed(2)}:1).`}
        />
      ) : null}

      <Section title="Button">
        <Button label="Réserver" onPress={() => {}} />
        <Button label="Voir les formules" variant="secondary" onPress={() => {}} />
        <Button label="Rejoindre la liste d'attente" variant="ghost" onPress={() => {}} />
        <Button label="Annuler ma réservation" variant="danger" onPress={() => {}} />
        <Button label="Chargement" loading onPress={() => {}} />
        <Button label="Indisponible" disabled onPress={() => {}} />
      </Section>

      <Section title="IconButton">
        <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
          <IconButton accessibilityLabel="Fermer" onPress={() => {}}>
            <Text style={{ color: theme.colors.text, fontSize: theme.typography.title }}>×</Text>
          </IconButton>
          <IconButton accessibilityLabel="Ajouter" onPress={() => {}}>
            <Text style={{ color: theme.colors.primary, fontSize: theme.typography.title }}>+</Text>
          </IconButton>
        </View>
      </Section>

      <Section title="Card">
        <Card>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamily }}>
            Conteneur simple
          </Text>
        </Card>
        <Card onPress={() => {}} accessibilityLabel="Carte actionnable">
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamily }}>
            Carte actionnable
          </Text>
        </Card>
      </Section>

      <Section title="ListRow">
        <ListRow
          title="WOD — 18h30"
          subtitle="Sarah D. · Salle principale"
          leading={<Avatar name="Sarah Dupont" size="sm" />}
          trailing={<Badge label="3 places" tone="success" />}
          onPress={() => {}}
        />
        <ListRow
          title="Haltérophilie — 19h30"
          subtitle="Complet · 2 en liste d'attente"
          leading={<Avatar name="Marc Lefevre" size="sm" />}
          trailing={<Badge label="Complet" tone="danger" />}
          onPress={() => {}}
        />
        <ListRow title="Open Gym — 20h30" subtitle="Sans réservation" disabled />
      </Section>

      <Section title="Avatar">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space(3) }}>
          <Avatar name="Léa Martin" size="sm" />
          <Avatar name="Jean-Baptiste Durand" size="md" />
          <Avatar name="Sarah Dupont" size="lg" />
        </View>
      </Section>

      <Section title="Badge">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2) }}>
          <Badge label="Neutre" />
          <Badge label="Rx" tone="primary" />
          <Badge label="Confirmé" tone="success" />
          <Badge label="Bientôt complet" tone="warning" />
          <Badge label="Complet" tone="danger" />
        </View>
      </Section>

      <Section title="Tabs">
        <Tabs
          accessibilityLabel="Sections"
          selectedKey={tab}
          onSelect={setTab}
          items={[
            { key: 'planning', label: 'Planning' },
            { key: 'wod', label: 'WOD du jour' },
            { key: 'classement', label: 'Classement' },
            { key: 'profil', label: 'Profil' },
          ]}
        />
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          accessibilityLabel="Niveau"
          value={level}
          onChange={setLevel}
          options={[
            { value: 'rx', label: 'Rx' },
            { value: 'scaled', label: 'Scaled' },
            { value: 'beginner', label: 'Débutant' },
          ]}
        />
      </Section>

      <Section title="Input">
        <Input label="Prénom" value={name} onChangeText={setName} placeholder="Léa" />
        <Input
          label="E-mail"
          value="pas-un-email"
          onChangeText={() => {}}
          error="Adresse e-mail invalide."
        />
        <Input
          label="Téléphone"
          value=""
          onChangeText={() => {}}
          hint="Facultatif, utilisé pour les annulations de dernière minute."
        />
      </Section>

      <Section title="Select">
        <Select
          label="Coach"
          placeholder="Choisir un coach"
          value={coach}
          onChange={setCoach}
          options={[
            { value: 'sarah', label: 'Sarah D.' },
            { value: 'marc', label: 'Marc L.' },
            { value: 'julie', label: 'Julie K.' },
          ]}
        />
      </Section>

      <Section title="Switch">
        <Switch
          label="Rappel de cours"
          description="La veille à 18 h"
          value={notify}
          onValueChange={setNotify}
        />
        <Switch label="Apparaître au classement" value={false} onValueChange={() => {}} />
        <Switch label="Réglage verrouillé" value disabled onValueChange={() => {}} />
      </Section>

      <Section title="Sheet">
        <Button label="Ouvrir une feuille" variant="secondary" onPress={() => setSheetOpen(true)} />
        <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Annuler ma place ?">
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamily }}>
            Il reste moins de 4 h avant le cours : ton crédit sera consommé.
          </Text>
          <Button
            label="Confirmer l'annulation"
            variant="danger"
            fullWidth
            onPress={() => setSheetOpen(false)}
          />
        </Sheet>
      </Section>

      <Section title="Toast">
        <Toast message="Score enregistré." />
        <Toast message="Nouveau record : Fran en 7:19." tone="success" />
        <Toast message="Ton paiement n'est pas passé." tone="danger" />
      </Section>

      <Section title="Banner">
        <Banner title="Mode hors ligne" description="Voici ta dernière version enregistrée." />
        <Banner
          tone="danger"
          title="Paiement en échec"
          description="Mets à jour ta carte pour garder ton accès."
          action={<Button label="Mettre à jour" variant="secondary" onPress={() => {}} />}
        />
      </Section>

      <Section title="Skeleton">
        <Skeleton height={20} />
        <Skeleton height={20} width="70%" />
        <Skeleton height={64} radius={theme.radius.lg} />
      </Section>

      <Section title="EmptyState">
        <Card>
          <EmptyState
            title="Aucune séance prévue"
            description="Ton prochain WOD t'attend."
            action={<Button label="Voir le planning" onPress={() => {}} />}
          />
        </Card>
      </Section>
    </ScrollView>
  );
}
