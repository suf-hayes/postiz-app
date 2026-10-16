'use client';

import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { NullspoolDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/nullspool.dto';
import { Input } from '@gitroom/react/form/input';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';

const SettingsComponent = () => {
  const form = useSettings();

  return <Input label="Episode slug" {...form.register('slug')} />;
};

export default withProvider({
  postComment: PostComment.POST,
  minimumCharacters: [],
  SettingsComponent: SettingsComponent,
  CustomPreviewComponent: undefined,
  dto: NullspoolDto,
  maximumCharacters: 100000,
});
