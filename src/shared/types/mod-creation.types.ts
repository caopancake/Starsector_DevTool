export interface NewModTemplate {
  id: string;
  name: string;
  version: string;
  gameVersion: string;
}

export type NewModDestination =
  | {
      kind: 'game-mods';
      starsectorRoot: string;
    }
  | {
      kind: 'directory';
      parentDirectory: string;
    };

export interface CreateModRequest {
  destination: NewModDestination;
  template: NewModTemplate;
}

export interface CreatedMod {
  modRoot: string;
  starsectorRoot: string | null;
}
