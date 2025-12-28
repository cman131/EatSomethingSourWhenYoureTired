import React from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface ResourceLink {
  name: string;
  href: string;
  description?: string;
}

interface ResourceCategory {
  title: string;
  links: ResourceLink[];
}

const Resources: React.FC = () => {
  const resourceCategories: ResourceCategory[] = [
    {
      title: 'Learning Resources',
      links: [
        {
            name: 'Yaku Reference Book',
            href: 'https://docs.google.com/document/d/1vtuRiT5a6QBx7ggaOQ5P4SlnySxssZxbX6uZeHKYzOI/edit?usp=sharing',
            description: 'A reference book for yaku in Riichi Mahjong'
        },
        {
            name: 'How to score your hand',
            href: 'https://docs.google.com/document/d/1Cai2O3TsZyv3nV-gXU46I6taYoDFjlutNiOxS2n-BB0/edit?usp=sharing',
            description: 'A guide on how to score your hand in Riichi Mahjong'
        },
        {
            name: 'Scoring quiz',
            href: 'https://docs.google.com/document/d/1oiVkcSWLIm0ZESQtXItH0EoWTAexqvhl7mrHcRQZ--M/edit?usp=sharing',
            description: 'A quiz to practice scoring your hand (answers in comments)'
        },
        {
            name: 'Riichi book',
            href: 'https://ooyamaneko.net/download/mahjong/riichi/Daina_Chiba_-_Riichi_Book_1_en.pdf',
            description: 'A highly recommended strategy reference written in English'
        },
      ]
    },
    {
      title: 'Recommended Applications',
      links: [
        {
          name: 'Mahjong Soul',
          href: 'https://mahjongsoul.game.yo-star.com/',
          description: 'A phenomenal application to play riichi mahjong online for Mobile and Browser. Can play AI, friends, and/or online people.'
        },
        {
          name: 'Tenhou',
          href: 'https://tenhou.net/4/',
          description: 'An application to play riichi mahjong online like Mahjong soul. This one is more popular with hipsters.'
        }
      ]
    },
    {
      title: 'Recommended Products',
      links: [
        {
          name: 'Merch Shop',
          href: 'https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club',
          description: 'Purchase Charleston Riichi Mahjong Club merchandise'
        },
        {
          name: 'Regular Riichi Tileset',
          href: 'https://www.amazon.com/dp/B003UU129U/ref=emc_b_5_t',
          description: 'A regular riichi tileset'
        },
        {
          name: 'Conor\'s Black/Yellow Riichi Tileset',
          href: 'https://www.amazon.com/gp/product/B003UTX4L0/ref=ppx_yo_dt_b_search_asin_title',
          description: 'A black/yellow riichi tileset'
        },
        {
          name: 'Junkmat',
          href: 'https://www.amazon.com/gp/product/B0017KHW3A/ref=ppx_yo_dt_b_asin_title_o00_s00',
          description: 'A junkmat'
        },
        {
          name: 'Amos Compass',
          href: 'https://www.amazon.co.jp/-/en/AMOS-COMPASS-Mahjong-Support-Plate/dp/B085T6ZL47/ref=sr_1_2',
          description: 'A compass to indicate seats and place tiles against'
        },
      ]
    },
    {
      title: 'Tools & Calculators',
      links: [
        {
          name: 'Riichi Calc',
          href: 'https://play.google.com/store/apps/details?id=ric.ov.RiichiCalc',
          description: 'A scoring app that\'s really good for Android.'
        },
        {
          name: 'Riichi Mahjong Hand Calculator',
          href: 'https://apps.apple.com/us/app/riichi-mahjong-hand-calculator/id1160349726',
          description: 'A scoring app that\'s okay and for Apple products.'
        },
        {
          name: 'Mahjong Hand Calculator',
          href: 'https://www.mahjonghandcalculator.com/',
          description: 'Calculate hand values and yaku combinations'
        },
        {
          name: 'Riichi Calculator',
          href: 'https://riichi.wiki/Calculator',
          description: 'Official Riichi Wiki calculator for scoring'
        },
      ]
    },
    {
      title: 'Organizations & Tournaments',
      links: [
        {
          name: 'North American Riichi Mahjong Association',
          href: 'https://www.narma.org/',
          description: 'Official NARMA website with tournament information and rankings'
        },
      ]
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Resources</h1>
        <p className="text-gray-600">
          A curated list of useful links for Riichi Mahjong players
        </p>
      </div>

      <div className="space-y-8">
        {resourceCategories.map((category) => (
          <div key={category.title} className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {category.title}
            </h2>
            <div className="space-y-3">
              {category.links.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-medium text-gray-900 group-hover:text-primary-600">
                          {link.name}
                        </h3>
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400 group-hover:text-primary-600" />
                      </div>
                      {link.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {link.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2 truncate">
                        {link.href}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Resources;

