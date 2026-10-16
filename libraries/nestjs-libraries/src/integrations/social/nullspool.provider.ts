import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import { SocialAbstract } from '../social.abstract';
import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from './social.integrations.interface';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { NullspoolDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/nullspool.dto';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

// One channel is one Nullspool show. At the scheduled time post() asks the nullspool.com release
// endpoint to put that show's episode live; the endpoint starts a GitHub Actions release and
// Pushover reports how it went. Postiz's job ends when the endpoint accepts the request.
type Details = { url: string; show: string; token: string };

// Same rule the endpoint applies to show ids and slugs.
const NAME = /^[a-z0-9][a-z0-9-]{0,79}$/;

export class NullspoolProvider extends SocialAbstract implements SocialProvider {
  identifier = 'nullspool';
  name = 'Nullspool';
  isBetweenSteps = false;
  scopes = [] as string[];
  editor = 'normal' as const;
  dto = NullspoolDto;

  maxLength() {
    return 100000;
  }

  async customFields() {
    return [
      {
        key: 'url',
        label: 'Release endpoint',
        defaultValue: 'https://nullspool.com/api/release',
        // https only: the token travels in a header.
        validation: `/^https:\\/\\/[a-z0-9.-]+(?::\\d{2,5})?\\/[^\\s?#]*$/`,
        type: 'text' as const,
      },
      {
        key: 'show',
        label: 'Show id (e.g. rules)',
        validation: `/^[a-z0-9][a-z0-9-]{0,79}$/`,
        type: 'text' as const,
      },
      {
        key: 'token',
        label: 'Release token',
        validation: `/^\\S{20,4096}$/`,
        type: 'password' as const,
      },
    ];
  }

  async refreshToken(): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const state = makeSecureId(6);
    return { url: state, codeVerifier: makeSecureId(10), state };
  }

  private request(details: Details, body: object) {
    return this.fetch(details.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${details.token}`,
      },
      body: JSON.stringify(body),
    });
  }

  // Called when the channel is added: the endpoint answers {"check": true} with 200 for a good
  // token and 401 otherwise, and starts nothing.
  async authenticate(params: { code: string; codeVerifier: string; refresh?: string }) {
    let details: Details;
    try {
      details = JSON.parse(Buffer.from(params.code, 'base64').toString());
    } catch {
      return 'Invalid details';
    }
    if (!NAME.test(details.show || '')) return 'Invalid show id';
    try {
      await this.request(details, { check: true });
    } catch {
      return 'The release endpoint refused this token';
    }
    return {
      // Stored but unused: post() reads the token from customInstanceDetails.
      refreshToken: '',
      accessToken: 'nullspool',
      expiresIn: dayjs().add(100, 'years').unix() - dayjs().unix(),
      id: `nullspool-${details.show}`,
      name: details.show,
      picture: '',
      username: details.show,
    };
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<NullspoolDto>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const details: Details = JSON.parse(
      AuthService.fixedDecryption(integration.customInstanceDetails!)
    );
    const slug = postDetails[0].settings?.slug || '';
    if (!NAME.test(slug)) {
      throw new Error(`Nullspool: bad episode slug "${slug}"`);
    }
    // Postiz runs post() at the scheduled time and doesn't pass that time in, so "now" is the
    // release time; nullspool records min(at, now) either way.
    await this.request(details, { show: details.show, slug, at: new Date().toISOString() });
    return [
      {
        id: postDetails[0].id,
        status: 'completed',
        releaseURL: new URL(details.url).origin,
        postId: `${details.show}/${slug}`,
      },
    ];
  }
}
